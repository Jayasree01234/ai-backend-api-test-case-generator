from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session

from openpyxl import Workbook

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer
)
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER

from app.database import get_db
from app import models
from app.auth import get_current_user


router = APIRouter(
    prefix="/projects",
    tags=["Exports"]
)


# ============================================================
# HELPER: CHECK PROJECT ACCESS
# ============================================================

def get_user_project(
    project_id: int,
    db: Session,
    current_user: models.User
):
    project = db.query(
        models.Project
    ).filter(
        models.Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this project"
        )

    return project


# ============================================================
# HELPER: GET PROJECT TEST CASES
# ============================================================

def get_project_test_cases(
    project_id: int,
    db: Session,
    current_user: models.User
):
    project = get_user_project(
        project_id,
        db,
        current_user
    )

    apis = db.query(
        models.API
    ).filter(
        models.API.project_id == project.id
    ).all()

    if not apis:
        raise HTTPException(
            status_code=404,
            detail="No APIs found in this project"
        )

    api_ids = [
        api.id
        for api in apis
    ]

    test_cases = db.query(
        models.TestCase
    ).filter(
        models.TestCase.api_id.in_(api_ids)
    ).all()

    if not test_cases:
        raise HTTPException(
            status_code=404,
            detail="No generated test cases found"
        )

    return project, test_cases


# ============================================================
# EXPORT TEST CASES TO EXCEL
# ============================================================

@router.get(
    "/{project_id}/export/excel"
)
def export_excel(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    project, test_cases = get_project_test_cases(
        project_id,
        db,
        current_user
    )

    workbook = Workbook()

    worksheet = workbook.active
    worksheet.title = "Test Cases"

    headers = [
        "ID",
        "API ID",
        "Title",
        "Method",
        "Endpoint",
        "Test Type",
        "Description",
        "Request Data",
        "Expected Result"
    ]

    worksheet.append(headers)

    for test_case in test_cases:

        worksheet.append([
            test_case.id,
            test_case.api_id,
            test_case.title,
            test_case.method,
            test_case.endpoint,
            test_case.test_type,
            test_case.description,
            test_case.request_data or "",
            test_case.expected_result
        ])

    # --------------------------------------------------------
    # HEADER FORMATTING
    # --------------------------------------------------------

    for cell in worksheet[1]:
        cell.font = cell.font.copy(
            bold=True
        )

        cell.alignment = cell.alignment.copy(
            horizontal="center",
            vertical="center"
        )

    # --------------------------------------------------------
    # COLUMN WIDTHS
    # --------------------------------------------------------

    column_widths = {
        "A": 8,
        "B": 10,
        "C": 35,
        "D": 12,
        "E": 25,
        "F": 15,
        "G": 55,
        "H": 50,
        "I": 55
    }

    for column, width in column_widths.items():
        worksheet.column_dimensions[
            column
        ].width = width

    worksheet.freeze_panes = "A2"

    worksheet.auto_filter.ref = worksheet.dimensions

    # --------------------------------------------------------
    # CREATE FILE
    # --------------------------------------------------------

    file_stream = BytesIO()

    workbook.save(file_stream)

    file_stream.seek(0)

    filename = (
        f"project_{project.id}_test_cases.xlsx"
    )

    return StreamingResponse(
        file_stream,
        media_type=(
            "application/vnd.openxmlformats-"
            "officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        }
    )


# ============================================================
# EXPORT TEST CASES TO PDF
# ============================================================

@router.get(
    "/{project_id}/export/pdf"
)
def export_pdf(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    project, test_cases = get_project_test_cases(
        project_id,
        db,
        current_user
    )

    file_stream = BytesIO()

    document = SimpleDocTemplate(
        file_stream,
        pagesize=landscape(A4),
        rightMargin=20,
        leftMargin=20,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()

    title_style = styles["Title"]
    title_style.alignment = TA_CENTER

    normal_style = styles["BodyText"]

    elements = []

    # --------------------------------------------------------
    # TITLE
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            f"AI Backend API Test Cases - {project.name}",
            title_style
        )
    )

    elements.append(
        Spacer(1, 15)
    )

    # --------------------------------------------------------
    # TABLE HEADER
    # --------------------------------------------------------

    table_data = [
        [
            "ID",
            "Title",
            "Method",
            "Endpoint",
            "Type",
            "Description",
            "Request Data",
            "Expected Result"
        ]
    ]

    # --------------------------------------------------------
    # TABLE DATA
    # --------------------------------------------------------

    for test_case in test_cases:

        table_data.append([
            str(test_case.id),

            Paragraph(
                test_case.title,
                normal_style
            ),

            test_case.method,

            test_case.endpoint,

            test_case.test_type,

            Paragraph(
                test_case.description,
                normal_style
            ),

            Paragraph(
                test_case.request_data or "",
                normal_style
            ),

            Paragraph(
                test_case.expected_result,
                normal_style
            )
        ])

    # --------------------------------------------------------
    # CREATE TABLE
    # --------------------------------------------------------

    table = Table(
        table_data,
        repeatRows=1,
        colWidths=[
            30,
            100,
            45,
            90,
            55,
            150,
            130,
            150
        ]
    )

    table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.grey
            ),

            (
                "TEXTCOLOR",
                (0, 0),
                (-1, 0),
                colors.white
            ),

            (
                "FONTNAME",
                (0, 0),
                (-1, 0),
                "Helvetica-Bold"
            ),

            (
                "ALIGN",
                (0, 0),
                (-1, 0),
                "CENTER"
            ),

            (
                "VALIGN",
                (0, 0),
                (-1, -1),
                "TOP"
            ),

            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.5,
                colors.black
            ),

            (
                "FONTSIZE",
                (0, 0),
                (-1, -1),
                7
            ),

            (
                "LEFTPADDING",
                (0, 0),
                (-1, -1),
                4
            ),

            (
                "RIGHTPADDING",
                (0, 0),
                (-1, -1),
                4
            ),

            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                4
            ),

            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                4
            )
        ])
    )

    elements.append(table)

    # --------------------------------------------------------
    # BUILD PDF
    # --------------------------------------------------------

    document.build(elements)

    file_stream.seek(0)

    filename = (
        f"project_{project.id}_test_cases.pdf"
    )

    return StreamingResponse(
        file_stream,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        }
    )


# ============================================================
# EXPORT PROJECT APIs TO POSTMAN
# ============================================================

@router.get(
    "/{project_id}/export/postman"
)
def export_postman(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    # --------------------------------------------------------
    # CHECK PROJECT ACCESS
    # --------------------------------------------------------

    project = get_user_project(
        project_id,
        db,
        current_user
    )

    # --------------------------------------------------------
    # GET PROJECT APIs
    # --------------------------------------------------------

    apis = db.query(
        models.API
    ).filter(
        models.API.project_id == project.id
    ).all()

    if not apis:
        raise HTTPException(
            status_code=400,
            detail="No APIs found in this project"
        )

    # --------------------------------------------------------
    # CREATE POSTMAN ITEMS
    # --------------------------------------------------------

    postman_items = []

    for api in apis:

        endpoint = api.endpoint

        path_parts = [
            part
            for part in endpoint.strip("/").split("/")
            if part
        ]

        request_data = {
            "method": api.method.upper(),

            "header": [
                {
                    "key": "Content-Type",
                    "value": "application/json",
                    "type": "text"
                }
            ],

            "body": {
                "mode": "raw",
                "raw": api.request_body or ""
            },

            "url": {
                "raw": "{{base_url}}" + endpoint,

                "host": [
                    "{{base_url}}"
                ],

                "path": path_parts
            }
        }

        postman_item = {
            "name": (
                f"{api.method.upper()} {endpoint}"
            ),

            "request": request_data
        }

        postman_items.append(
            postman_item
        )

    # --------------------------------------------------------
    # CREATE POSTMAN COLLECTION
    # --------------------------------------------------------

    collection = {
        "info": {
            "name": project.name,

            "description": (
                project.description or ""
            ),

            "schema": (
                "https://schema.getpostman.com/"
                "json/collection/v2.1.0/"
                "collection.json"
            )
        },

        "variable": [
            {
                "key": "base_url",
                "value": "http://127.0.0.1:8000"
            }
        ],

        "item": postman_items
    }

    # --------------------------------------------------------
    # RETURN POSTMAN JSON
    # --------------------------------------------------------

    return JSONResponse(
        content=collection,
        headers={
            "Content-Disposition": (
                f'attachment; '
                f'filename="project_{project_id}_postman.json"'
            )
        }
    )