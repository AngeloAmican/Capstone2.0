<?php

header("Content-Type: application/json; charset=UTF-8");

require_once "../php/db_connect.php";

function response($success, $message)
{
    echo json_encode([
        "success" => $success,
        "message" => $message
    ]);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    response(false, "Invalid request.");
}

$firstname = trim($_POST["firstname"] ?? "");
$lastname = trim($_POST["lastname"] ?? "");
$email = strtolower(trim($_POST["email"] ?? ""));
$password = $_POST["password"] ?? "";
$confirm_password = $_POST["confirm_password"] ?? "";

if (
    $firstname === "" ||
    $lastname === "" ||
    $email === "" ||
    $password === "" ||
    $confirm_password === ""
) {
    response(false, "Please complete all required fields.");
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    response(false, "Please enter a valid email address.");
}

if ($password !== $confirm_password) {
    response(false, "Passwords do not match. Please try again.");
}

if (
    strlen($password) < 8 ||
    !preg_match("/[A-Z]/", $password) ||
    !preg_match("/[0-9]/", $password) ||
    !preg_match("/[^a-zA-Z0-9]/", $password)
) {
    response(false, "Password does not meet all requirements.");
}

$check = $conn->prepare("
    SELECT user_id
    FROM tbl_users
    WHERE LOWER(email) = ?
    LIMIT 1
");

if (!$check) {
    response(false, "Database error while checking the email.");
}

$check->bind_param("s", $email);
$check->execute();
$check->store_result();

if ($check->num_rows > 0) {
    $check->close();

    response(
        false,
        "An account with this email already exists! Please log in."
    );
}

$check->close();

$name = trim($firstname . " " . $lastname);
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

$role = "user";
$accessLevel = "user";
$status = "Active";

$stmt = $conn->prepare("
    INSERT INTO tbl_users
    (
        firstname,
        lastname,
        name,
        email,
        password,
        role,
        department,
        staff_id,
        access_level,
        status,
        profile_image,
        contact
    )
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL)
");

if (!$stmt) {
    response(false, "Database error while creating the account.");
}

$stmt->bind_param(
    "ssssssss",
    $firstname,
    $lastname,
    $name,
    $email,
    $hashedPassword,
    $role,
    $accessLevel,
    $status
);

if (!$stmt->execute()) {
    $stmt->close();
    $conn->close();

    response(
        false,
        "Unable to create the account. Please try again."
    );
}

$stmt->close();
$conn->close();

response(
    true,
    "Account created successfully! Redirecting to login..."
);
?>