<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../php/db_connect.php';

if (empty($_SESSION['logged_in']) || empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}

$result = $conn->query("SELECT user_id, firstname, lastname, name, email, doctor_id, specialization, profile_image, contact FROM tbl_users WHERE LOWER(TRIM(role)) = 'doctor' AND LOWER(TRIM(COALESCE(NULLIF(status, ''), 'active'))) = 'active' ORDER BY lastname, firstname, user_id");
$doctors = [];
while ($doctor = $result->fetch_assoc()) {
    $userId = (int) $doctor['user_id'];
    $doctorId = trim((string) ($doctor['doctor_id'] ?? ''));
    if ($doctorId === '') {
        $doctorId = 'DOC-' . str_pad((string) $userId, 4, '0', STR_PAD_LEFT);
    }
    $name = trim((string) ($doctor['name'] ?: ($doctor['firstname'] . ' ' . $doctor['lastname'])));
    $doctors[] = [
        'id' => $doctorId,
        'user_id' => $userId,
        'doctor_id' => $doctorId,
        'doctorId' => $doctorId,
        'firstname' => $doctor['firstname'],
        'lastname' => $doctor['lastname'],
        'name' => $name,
        'fullName' => $name,
        'email' => $doctor['email'],
        'specialization' => $doctor['specialization'] ?: 'Dental Care',
        'profile_image' => $doctor['profile_image'],
        'contact' => $doctor['contact'],
        'role' => 'doctor',
    ];
}

echo json_encode(['success' => true, 'data' => $doctors], JSON_UNESCAPED_UNICODE);