import sqlite3

conn = sqlite3.connect("app.db")
cursor = conn.cursor()

print("Current test_cases columns:")

columns = cursor.execute(
    "PRAGMA table_info(test_cases)"
).fetchall()

for column in columns:
    print(column)

conn.close()