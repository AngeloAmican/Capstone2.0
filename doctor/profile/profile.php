<?php
session_start();
header("Content-Type: application/json; charset=UTF-8");
require_once "../../php/db_connect.php";
if ($_SERVER["REQUEST_METHOD"] === "POST" && ($_POST["action"] ?? "") === "logout") {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), "", time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
    }
    session_destroy();
    echo json_encode([
        "success" => true,
        "message" => "Logged out successfully."
    ]);
    exit;
}
if (!isset($_SESSION["logged_in"]) || $_SESSION["logged_in"] !== true || !isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Unauthorized."
    ]);
    exit;
}
$userId = (int) $_SESSION["user_id"];
$stmt = $conn->prepare("
    SELECT
        user_id,
        firstname,
        lastname,
        name,
        email,
        role,
        doctor_id,
        specialization,
        status,
        profile_image,
        contact
    FROM tbl_users
    WHERE user_id = ?
    AND role = 'doctor'
    LIMIT 1
");
if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database error."
    ]);
    exit;
}
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
if (!$result || $result->num_rows === 0) {
    $stmt->close();
    $conn->close();
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Doctor access required."
    ]);
    exit;
}
$doctor = $result->fetch_assoc();
$stmt->close();
$conn->close();
echo json_encode([
    "success" => true,
    "user" => $doctor
]);
?>