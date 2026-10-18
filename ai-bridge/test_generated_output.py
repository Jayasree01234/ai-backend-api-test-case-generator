import pytest
import requests

BASE_URL = "http://localhost:8080"

def test_get_users_successfully_1():
    response = requests.get(BASE_URL + '/users')
    assert response.status_code == 200

def test_get_users_with_invalid_query_parameter_2():
    response = requests.get(BASE_URL + '/users')
    assert response.status_code == 400

def test_get_users_with_empty_query_parameter_3():
    response = requests.get(BASE_URL + '/users')
    assert response.status_code == 200

def test_get_users_with_non_integer_query_parameter_4():
    response = requests.get(BASE_URL + '/users')
    assert response.status_code == 400

def test_get_users_with_query_parameter_having_value_true_5():
    response = requests.get(BASE_URL + '/users')
    assert response.status_code == 200

def test_get_users_with_query_parameter_having_value_false_6():
    response = requests.get(BASE_URL + '/users')
    assert response.status_code == 200

def test_get_users_with_query_parameter_having_value_7():
    response = requests.get(BASE_URL + '/users')
    assert response.status_code == 200

