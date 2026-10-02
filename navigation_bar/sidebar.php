<?php
session_start();
header("Content-Type: application/json; charset=UTF-8");
require_once "../php/db_connect.php";

function response($success, $message, $user = null) {
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "user" => $user
    ]);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && ($_POST["action"] ?? "") === "logout") {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), "", time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
    }
    session_destroy();
    response(true, "Logged out successfully.");
}

if (!isset($_SESSION["logged_in"]) || $_SESSION["logged_in"] !== true || !isset($_SESSION["user_id"])) {
    http_response_code(401);
    response(false, "Unauthorized.");
}

$requestedRole = strtolower(trim((string)($_GET["role"] ?? "")));
if ($requestedRole !== "staff" && $requestedRole !== "patient") {
    http_response_code(400);
    response(false, "A valid sidebar role is required.");
}

$userId = (int)$_SESSION["user_id"];
$databaseRole = $requestedRole === "patient" ? "user" : "staff";
$stmt = $conn->prepare("
        SELECT user_id, firstname, lastname, name, email, role, department,
            staff_id, access_level, status, profile_image, contact
    FROM tbl_users
    WHERE user_id = ? AND role = ?
    LIMIT 1
");
if (!$stmt) {
    http_response_code(500);
    response(false, "Database error while loading your account.");
}
$stmt->bind_param("is", $userId, $databaseRole);
$stmt->execute();
$result = $stmt->get_result();
if (!$result || $result->num_rows === 0) {
    $stmt->close();
    $conn->close();
    http_response_code(403);
    response(false, ucfirst($requestedRole) . " access required.");
}
$user = $result->fetch_assoc();
$stmt->close();

if ($requestedRole === "staff") {
    $staffId = "STF-" . str_pad((string)$userId, 4, "0", STR_PAD_LEFT);
    $updateIdStmt = $conn->prepare("UPDATE tbl_users SET staff_id = ?, doctor_id = NULL WHERE user_id = ? AND role = 'staff' LIMIT 1");
    $updateIdStmt->bind_param("si", $staffId, $userId);
    $updateIdStmt->execute();
    $updateIdStmt->close();
    $user["staff_id"] = $staffId;
    $_SESSION["staff_id"] = $staffId;
}

$conn->close();
response(true, "Account loaded successfully.", $user);
?>