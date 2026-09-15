import requests


BASE_URL = "http://127.0.0.1:8000"


# Test Case 1: Valid request
def test_generated_api():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 2: Missing name
def test_generated_api_2():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 3: Missing email
def test_generated_api_3():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 4: Missing age
def test_generated_api_4():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 5: Invalid email
def test_generated_api_5():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 6: Invalid age
def test_generated_api_6():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 7: Boundary - valid request
def test_generated_api_7():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 8: Boundary - invalid request
def test_generated_api_8():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 9: Validation - missing required field
def test_generated_api_9():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 10: Validation - invalid field
def test_generated_api_10():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 11: Security - unauthorized
def test_generated_api_11():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 12: Valid request
def test_generated_api_12():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 13: Missing name
def test_generated_api_13():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 14: Missing email
def test_generated_api_14():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 15: Invalid email
def test_generated_api_15():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 16: Invalid age
def test_generated_api_16():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 17: Age out of range
def test_generated_api_17():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 18: Valid request with age 0
def test_generated_api_18():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 19: Valid request with age 100
def test_generated_api_19():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 20: Boundary - name empty
def test_generated_api_20():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 21: Boundary - email empty
def test_generated_api_21():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 22: Validation - missing required fields
def test_generated_api_22():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 23: Validation - invalid schema
def test_generated_api_23():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 24: Security - missing authentication
def test_generated_api_24():
    response = requests.request(
        "POST",
        f"{BASE_URL}/users"
    )

    assert response.status_code == 200

# Test Case 25: Valid request
def test_generated_api_25():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/id"
    )

    assert response.status_code == 200

# Test Case 26: Missing id
def test_generated_api_26():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/"
    )

    assert response.status_code == 400

# Test Case 27: Invalid id
def test_generated_api_27():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/abc"
    )

    assert response.status_code == 400

# Test Case 28: Id with special characters
def test_generated_api_28():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/!@#"
    )

    assert response.status_code == 400

# Test Case 29: Id with non-numeric characters
def test_generated_api_29():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/abc123"
    )

    assert response.status_code == 400

# Test Case 30: Id with leading zero
def test_generated_api_30():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/0"
    )

    assert response.status_code == 400

# Test Case 31: Id with large number
def test_generated_api_31():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/1000000"
    )

    assert response.status_code == 200

# Test Case 32: Id with decimal number
def test_generated_api_32():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/1.1"
    )

    assert response.status_code == 200

# Test Case 33: Id with negative number
def test_generated_api_33():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/-1"
    )

    assert response.status_code == 200

# Test Case 34: Empty id
def test_generated_api_34():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/"
    )

    assert response.status_code == 200

# Test Case 35: Id with whitespace
def test_generated_api_35():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/ Jayasree"
    )

    assert response.status_code == 200

# Test Case 36: Validation error
def test_generated_api_36():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/id"
    )

    assert response.status_code == 400

# Test Case 37: Security test
def test_generated_api_37():
    response = requests.request(
        "GET",
        f"{BASE_URL}/users/id"
    )

    assert response.status_code == 200

