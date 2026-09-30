"""Automatically generated API test cases."""

import requests

BASE_URL = "http://127.0.0.1:8000"
REQUEST_TIMEOUT = 15


def test_generated_case_1():
    """Valid User Creation"""
    url = BASE_URL + '/users'
    response = requests.post(
        url,
        json={
    "name": "Test User",
    "email": "test@example.com",
    "age": 25
},
        timeout=REQUEST_TIMEOUT
    )
    assert response.status_code == 201


def test_generated_case_2():
    """Successful GET Request"""
    url = BASE_URL + '/users'
    response = requests.get(
        url,
        timeout=REQUEST_TIMEOUT
    )
    assert response.status_code == 200


def test_generated_case_3():
    """Successful GET Request"""
    url = BASE_URL + '/users/1'
    response = requests.get(
        url,
        timeout=REQUEST_TIMEOUT
    )
    assert response.status_code == 200


