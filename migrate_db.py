import sqlite3

DATABASE = "app.db"


def add_column(cursor, table, column_definition):
    try:
        cursor.execute(
            f"ALTER TABLE {table} ADD COLUMN {column_definition}"
        )
        print(f"Added: {column_definition}")

    except sqlite3.OperationalError as error:
        if "duplicate column name" in str(error):
            print(f"Already exists: {column_definition}")
        else:
            raise


connection = sqlite3.connect(DATABASE)
cursor = connection.cursor()

add_column(cursor, "test_cases", "test_code TEXT")
add_column(cursor, "test_cases", "actual_result TEXT")
add_column(
    cursor,
    "test_cases",
    "execution_status TEXT DEFAULT 'NOT RUN'"
)

connection.commit()
connection.close()

print("Database migration completed successfully.")