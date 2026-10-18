import pytest
import requests

BASE_URL = "http://localhost:8080"

def test_get_users_successfully_1():
    response = requests.get(BASE_URL + '/users')
    assert response.status_code == 200

def test_create_user_successfully_1():
    data = {
        "name": 'John Doe',
        "email": 'john@example.com',
        "age": 30,
    }
    response = requests.post(BASE_URL + '/users', json=data)
    assert response.status_code == 201

def test_create_user_with_invalid_age_2():
    data = {
        "name": 'John Doe',
        "email": 'john@example.com',
        "age": 'invalid-integer',
    }
    response = requests.post(BASE_URL + '/users', json=data)
    assert response.status_code == 400

def test_get_user_by_id_successfully_1():
    response = requests.get(BASE_URL + '/users/1')
    assert response.status_code == 200

def test_get_user_by_non_existent_id_2():
    response = requests.get(BASE_URL + '/users/999999')
    assert response.status_code == 404