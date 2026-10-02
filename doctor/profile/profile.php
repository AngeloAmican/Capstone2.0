<?php
session_start();
header("Content-Type: application/json; charset=UTF-8");
require_once "../../php/db_connect.php";
function response($success, $message, $user = null) {
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "user" => $user
    ]);
    exit;
}
if (!isset($_SESSION["logged_in"]) || $_SESSION["logged_in"] !== true || !isset($_SESSION["user_id"])) {
    http_response_code(401);
    response(false, "Unauthorized.");
}
$userId = (int) $_SESSION["user_id"];
if ($userId <= 0) {
    http_response_code(401);
    response(false, "Invalid user session.");
}
if ($_SERVER["REQUEST_METHOD"] === "POST" && ($_POST["action"] ?? "") === "update_profile") {
    $contact = trim((string)($_POST["contact"] ?? ""));
    $specialization = trim((string)($_POST["specialization"] ?? ""));
    if ($specialization === "") {
        http_response_code(422);
        response(false, "Specialization is required.");
    }
    if (!preg_match("/^09\\d{9}$/", $contact)) {
        http_response_code(422);
        response(false, "Use a valid 11-digit contact number starting with 09.");
    }
    $updateStmt = $conn->prepare("
        UPDATE tbl_users
        SET contact = ?, specialization = ?
        WHERE user_id = ?
        AND role = 'doctor'
        LIMIT 1
    ");
    if (!$updateStmt) {
        http_response_code(500);
        response(false, "Database error while saving your profile.");
    }
    $updateStmt->bind_param("ssi", $contact, $specialization, $userId);
    if (!$updateStmt->execute()) {
        $updateStmt->close();
        http_response_code(500);
        response(false, "Unable to save your profile.");
    }
    $updateStmt->close();
}

$stmt = $conn->prepare("SELECT user_id, firstname, lastname, name, email, role, doctor_id, specialization, access_level, status, profile_image, contact FROM tbl_users WHERE user_id = ? AND role = 'doctor' LIMIT 1");
if (!$stmt) {
    http_response_code(500);
    response(false, "Database error while loading your profile.");
}
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
if (!$result || $result->num_rows === 0) {
    $stmt->close();
    $conn->close();
    http_response_code(403);
    response(false, "Doctor access required.");
}
$doctor = $result->fetch_assoc();
$stmt->close();

$doctorId = "DOC-" . str_pad((string) $userId, 4, "0", STR_PAD_LEFT);
$updateIdStmt = $conn->prepare("UPDATE tbl_users SET doctor_id = ?, staff_id = NULL WHERE user_id = ? AND role = 'doctor' LIMIT 1");
$updateIdStmt->bind_param("si", $doctorId, $userId);
$updateIdStmt->execute();
$updateIdStmt->close();

$doctor["doctor_id"] = $doctorId;
$_SESSION["doctor_id"] = $doctorId;
$_SESSION["specialization"] = $doctor["specialization"] ?? "";
$conn->close();
response(true, "Doctor profile loaded successfully.", $doctor);
?>