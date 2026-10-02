<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../php/db_connect.php';

function jsonResponse(bool $success, string $message = '', $data = null, int $status = 200): void
{
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($_SESSION['logged_in']) || empty($_SESSION['user_id'])) {
    jsonResponse(false, 'Authentication required.', null, 401);
}

$role = strtolower(trim((string) ($_SESSION['role'] ?? '')));
$userId = (int) $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
$requestedPatientId = trim((string) ($_GET['patient_id'] ?? $_POST['patient_id'] ?? ''));

function ensurePatient(mysqli $conn, string $patientId, int $userId, string $role): void
{
    if ($role === 'user') {
        $patientId = trim((string) ($_SESSION['patient_id'] ?? $patientId));
        if ($patientId === '') {
            $patientId = 'PN-' . str_pad((string) $userId, 4, '0', STR_PAD_LEFT);
        }
    } elseif ($patientId === '') {
        jsonResponse(false, 'Patient ID is required.', null, 422);
    }
    if ($role !== 'user') {
        return;
    }
    $stmt = $conn->prepare("INSERT INTO tbl_patients (patient_id, user_id, first_name, last_name, email, patient_type, created_by) SELECT ?, user_id, COALESCE(firstname, ''), COALESCE(lastname, ''), email, 'registered', user_id FROM tbl_users WHERE user_id = ? ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)");
    $stmt->bind_param('si', $patientId, $userId);
    $stmt->execute();
    $stmt->close();
}

function patientRecordExists(mysqli $conn, string $patientId): bool
{
    $stmt = $conn->prepare('SELECT patient_id FROM tbl_patients WHERE patient_id = ? LIMIT 1');
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $exists = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    return $exists;
}

function generateWalkInPatientId(mysqli $conn): string
{
    $result = $conn->query("SELECT COALESCE(MAX(CAST(SUBSTRING(patient_id, 4) AS UNSIGNED)), 0) AS highest_id FROM tbl_patients WHERE patient_id REGEXP '^PN-[0-9]{4}$'");
    $row = $result ? $result->fetch_assoc() : ['highest_id' => 0];
    $nextId = ((int) ($row['highest_id'] ?? 0)) + 1;
    return 'PN-' . str_pad((string) $nextId, 4, '0', STR_PAD_LEFT);
}

function assertAccess(mysqli $conn, string $patientId, int $userId, string $role): void
{
    if ($role === 'doctor' || $role === 'staff') {
        return;
    }
    $stmt = $conn->prepare('SELECT patient_id FROM tbl_patients WHERE patient_id = ? AND user_id = ? LIMIT 1');
    $stmt->bind_param('si', $patientId, $userId);
    $stmt->execute();
    $allowed = $stmt->get_result()->num_rows === 1;
    $stmt->close();
    if (!$allowed) {
        jsonResponse(false, 'You may access only your own patient record.', null, 403);
    }
}

function decodeJsonValue(?string $value): array
{
    $decoded = json_decode((string) $value, true);
    return is_array($decoded) ? $decoded : [];
}

function triggerInventoryForecast(): void
{
    $pythonScript = __DIR__ . '/../forecasting/inventory_demand_forecast.py';

    if (!file_exists($pythonScript)) {
        error_log(
            'Inventory forecast script not found: ' . $pythonScript
        );
        return;
    }

    $command =
        'start /B "" py -3 ' .
        escapeshellarg($pythonScript) .
        ' --data-source treatments' .
        ' --db-host 127.0.0.1' .
        ' --db-port 3307' .
        ' --db-user root' .
        ' --db-name dental_clinic_system' .
        ' --save-to-db' .
        ' > NUL 2>&1';

    if (PHP_OS_FAMILY === 'Windows') {
        pclose(
            popen(
                $command,
                'r'
            )
        );
        return;
    }

    $command =
        'python3 ' .
        escapeshellarg($pythonScript) .
        ' --data-source treatments' .
        ' --db-host 127.0.0.1' .
        ' --db-port 3307' .
        ' --db-user root' .
        ' --db-name dental_clinic_system' .
        ' --save-to-db' .
        ' > /dev/null 2>&1 &';

    exec($command);
}

function patientPayload(mysqli $conn, string $patientId): ?array
{
    $stmt = $conn->prepare('SELECT * FROM tbl_patients WHERE patient_id = ? LIMIT 1');
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $patient = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$patient) {
        return null;
    }

    $patient['id'] = $patient['patient_id'];
    $patient['userId'] = $patient['user_id'];
    $patient['firstName'] = $patient['first_name'];
    $patient['lastName'] = $patient['last_name'];
    $patient['fullName'] = trim($patient['first_name'] . ' ' . $patient['last_name']);
    $patient['dateOfBirth'] = $patient['date_of_birth'];
    $patient['patientGender'] = $patient['gender'];
    $patient['emergencyName'] = $patient['emergency_name'];
    $patient['emergencyContact'] = $patient['emergency_contact'];
    $patient['appointments'] = [];
    $patient['treatments'] = [];
    $patient['clinicalImages'] = [];
    $patient['dentalChart'] = ['teeth' => []];

    $stmt = $conn->prepare('SELECT * FROM tbl_medical_forms WHERE patient_id = ? LIMIT 1');
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $medical = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($medical) {
        $patient['medicalForm'] = [
            'dentalConcern' => decodeJsonValue($medical['dental_concern']),
            'dentalConcernOther' => $medical['dental_concern_other'],
            'negativeExperience' => $medical['negative_experience'],
            'negativeExperienceNote' => $medical['negative_experience_note'],
            'medLastVisit' => $medical['last_dental_visit'],
            'medLastTreatment' => $medical['last_dental_treatment'],
            'currentMedications' => $medical['current_medications'],
            'currentMedicationsList' => $medical['current_medications_list'],
            'medicalHistory' => decodeJsonValue($medical['medical_history']),
            'medicalOther' => $medical['medical_other'],
            'allergies' => decodeJsonValue($medical['allergies']),
            'allergyOther' => $medical['allergy_other'],
            'consent' => (bool) $medical['consent'],
            'completed' => (bool) $medical['completed'],
            'createdAt' => $medical['created_at'],
            'updatedAt' => $medical['updated_at'],
        ];
    } else {
        $patient['medicalForm'] = null;
    }

    $stmt = $conn->prepare("SELECT a.*, COALESCE(NULLIF(u.doctor_id, ''), CONCAT('DOC-', LPAD(u.user_id, 4, '0'))) AS doctor_code, TRIM(COALESCE(u.name, CONCAT(u.firstname, ' ', u.lastname))) AS doctor_name FROM tbl_patient_appointments a LEFT JOIN tbl_users u ON u.user_id = a.doctor_id WHERE a.patient_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC");
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $appointments = $stmt->get_result();
    while ($row = $appointments->fetch_assoc()) {
        $patient['appointments'][] = [
            'id' => $row['appointment_uid'] ?: $row['appointment_id'],
            'appointmentId' => $row['appointment_id'],
            'appointment_uid' => $row['appointment_uid'],
            'patientId' => $row['patient_id'],
            'appointment_date' => $row['appointment_date'],
            'appointment_time' => $row['appointment_time'],
            'date' => $row['appointment_date'],
            'start' => $row['appointment_time'],
            'time' => $row['appointment_time'],
            'type' => $row['service_type'],
            'service' => $row['service_type'],
            'duration' => (int) $row['duration_minutes'],
            'dentist' => $row['doctor_code'],
            'dentistId' => $row['doctor_code'],
            'dentist_id' => $row['doctor_code'],
            'doctorId' => $row['doctor_code'],
            'doctor_id' => $row['doctor_code'],
            'dentistName' => $row['doctor_name'],
            'dentist_name' => $row['doctor_name'],
            'doctorName' => $row['doctor_name'],
            'doctor_name' => $row['doctor_name'],
            'status' => $row['status'],
            'checkedIn' => (bool) $row['checked_in'],
            'checkedInAt' => $row['checked_in_at'],
            'reason' => $row['reason'],
            'notes' => $row['notes'],
        ];
    }
    $stmt->close();

    $stmt = $conn->prepare('SELECT * FROM tbl_patient_treatments WHERE patient_id = ? ORDER BY treatment_date DESC, treatment_id DESC');
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $treatments = $stmt->get_result();
    while ($row = $treatments->fetch_assoc()) {
        $patient['treatments'][] = [
            'treatmentId' => $row['treatment_id'],
            'appointmentId' => $row['appointment_id'],
            'toothNumber' => $row['tooth_number'],
            'procedure' => $row['procedure_name'],
            'date' => $row['treatment_date'],
            'note' => $row['notes'],
            'consumedMaterials' => decodeJsonValue($row['consumed_materials']),
        ];
    }
    $stmt->close();

    $stmt = $conn->prepare('SELECT * FROM tbl_clinical_images WHERE patient_id = ? ORDER BY image_date DESC, image_id DESC');
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $images = $stmt->get_result();
    while ($row = $images->fetch_assoc()) {
        $patient['clinicalImages'][] = [
            'id' => (int) $row['image_id'],
            'imageId' => $row['image_id'],
            'title' => $row['title'],
            'description' => $row['description'],
            'beforeImageData' => preg_match('/^data:image\//', (string) $row['before_image']) ? $row['before_image'] : '/' . trim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/patient_records.php')), '/') . '/' . ltrim((string) $row['before_image'], '/'),
            'afterImageData' => preg_match('/^data:image\//', (string) $row['after_image']) ? $row['after_image'] : '/' . trim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/patient_records.php')), '/') . '/' . ltrim((string) $row['after_image'], '/'),
            'date' => $row['image_date'],
        ];
    }
    $stmt->close();

    $stmt = $conn->prepare('SELECT * FROM tbl_dental_chart WHERE patient_id = ? ORDER BY recorded_at DESC, dental_chart_id DESC');
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $chart = $stmt->get_result();
    while ($row = $chart->fetch_assoc()) {
        $toothNumber = (string) $row['tooth_number'];
        $patient['dentalChart']['teeth'][$toothNumber]['procedure'] = $row['procedure_name'];
        $patient['dentalChart']['teeth'][$toothNumber]['note'] = $row['notes'];
        $patient['dentalChart']['teeth'][$toothNumber]['updatedAt'] = $row['recorded_at'];
    }
    $stmt->close();
    return $patient;
}

if ($method === 'GET') {
    if ($role === 'user') {
        $patientStmt = $conn->prepare(
            'SELECT patient_id
             FROM tbl_patients
             WHERE user_id = ?
             AND status = "active"
             LIMIT 1'
        );

        if (!$patientStmt) {
            jsonResponse(false, 'Unable to load your patient record.', null, 500);
        }

        $patientStmt->bind_param('i', $userId);
        $patientStmt->execute();

        $patientRow = $patientStmt->get_result()->fetch_assoc();
        $patientStmt->close();

        if (!$patientRow) {
            jsonResponse(false, 'Patient record not found.', null, 404);
        }

        $requestedPatientId = (string) $patientRow['patient_id'];
    }

    if ($requestedPatientId === '') {
        $result = $conn->query(
            'SELECT patient_id
             FROM tbl_patients
             WHERE status = "active"
             ORDER BY last_name, first_name'
        );

        $records = [];

        while ($row = $result->fetch_assoc()) {
            $record = patientPayload($conn, $row['patient_id']);

            if ($record) {
                $records[] = $record;
            }
        }

        jsonResponse(true, 'Patients loaded.', $records);
    }

    ensurePatient($conn, $requestedPatientId, $userId, $role);
    assertAccess($conn, $requestedPatientId, $userId, $role);

    jsonResponse(
        true,
        'Patient record loaded.',
        patientPayload($conn, $requestedPatientId)
    );
}

if ($method === 'DELETE') {
    if ($role !== 'staff' && $role !== 'doctor') {
        jsonResponse(false, 'Only staff or doctors may delete patient records.', null, 403);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        $input = $_REQUEST;
    }
    $patientId = trim((string) ($input['patientId'] ?? $requestedPatientId));
    if ($patientId === '') {
        jsonResponse(false, 'Patient ID is required.', null, 422);
    }
    $stmt = $conn->prepare('DELETE FROM tbl_patients WHERE patient_id = ? LIMIT 1');
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $deleted = $stmt->affected_rows;
    $stmt->close();
    if ($deleted !== 1) {
        jsonResponse(false, 'Patient record was not found.', null, 404);
    }
    jsonResponse(true, 'Patient record deleted.', ['patientId' => $patientId]);
}

if ($method !== 'POST') {
    jsonResponse(false, 'Unsupported request method.', null, 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST;
}
$patientId = trim((string) ($input['patientId'] ?? $requestedPatientId));
if ($role === 'user') {
    $patientId = trim((string) ($_SESSION['patient_id'] ?? $patientId));
    if ($patientId === '') {
        $patientId = 'PN-' . str_pad((string) $userId, 4, '0', STR_PAD_LEFT);
    }
} elseif ($patientId === '') {
    $patientId = generateWalkInPatientId($conn);
}
ensurePatient($conn, $patientId, $userId, $role);
assertAccess($conn, $patientId, $userId, $role);
$patient = $input['patient'] ?? $input;
$medical = $input['medicalForm'] ?? null;
$forecastNeeded = false;
$conn->begin_transaction();
try {
    if (is_array($patient)) {
        $firstName = trim((string) ($patient['firstName'] ?? $patient['firstname'] ?? ''));
        $lastName = trim((string) ($patient['lastName'] ?? $patient['lastname'] ?? ''));
        $dateOfBirth = (string) ($patient['dateOfBirth'] ?? '');
        $gender = (string) ($patient['gender'] ?? $patient['patientGender'] ?? '');
        $phone = (string) ($patient['phone'] ?? '');
        $email = (string) ($patient['email'] ?? '');
        $address = (string) ($patient['address'] ?? '');
        $emergencyName = (string) ($patient['emergencyName'] ?? '');
        $emergencyContact = (string) ($patient['emergencyContact'] ?? '');
        $patientType = $role === 'user' ? 'registered' : 'walk_in';
        $stmt = $conn->prepare('INSERT IGNORE INTO tbl_patients (patient_id, first_name, last_name, date_of_birth, gender, phone, email, address, emergency_name, emergency_contact, patient_type, created_by) VALUES (?, ?, ?, NULLIF(?, ""), ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('sssssssssssi', $patientId, $firstName, $lastName, $dateOfBirth, $gender, $phone, $email, $address, $emergencyName, $emergencyContact, $patientType, $userId);
        $stmt->execute();
        $stmt->close();
    }
    if (is_array($patient)) {
        $stmt = $conn->prepare('UPDATE tbl_patients SET first_name = COALESCE(NULLIF(?, ""), first_name), last_name = COALESCE(NULLIF(?, ""), last_name), date_of_birth = COALESCE(NULLIF(?, ""), date_of_birth), gender = COALESCE(NULLIF(?, ""), gender), phone = COALESCE(NULLIF(?, ""), phone), email = COALESCE(NULLIF(?, ""), email), address = COALESCE(NULLIF(?, ""), address), emergency_name = COALESCE(NULLIF(?, ""), emergency_name), emergency_contact = COALESCE(NULLIF(?, ""), emergency_contact), updated_at = NOW() WHERE patient_id = ?');
        $stmt->bind_param('ssssssssss', $firstName, $lastName, $dateOfBirth, $gender, $phone, $email, $address, $emergencyName, $emergencyContact, $patientId);
        $stmt->execute();
        $stmt->close();
    }
    if (is_array($medical)) {
        $stmt = $conn->prepare('INSERT INTO tbl_medical_forms (patient_id, dental_concern, dental_concern_other, negative_experience, negative_experience_note, last_dental_visit, last_dental_treatment, current_medications, current_medications_list, medical_history, medical_other, allergies, allergy_other, consent, completed, submitted_by) VALUES (?, ?, ?, ?, ?, NULLIF(?, ""), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE dental_concern = VALUES(dental_concern), dental_concern_other = VALUES(dental_concern_other), negative_experience = VALUES(negative_experience), negative_experience_note = VALUES(negative_experience_note), last_dental_visit = VALUES(last_dental_visit), last_dental_treatment = VALUES(last_dental_treatment), current_medications = VALUES(current_medications), current_medications_list = VALUES(current_medications_list), medical_history = VALUES(medical_history), medical_other = VALUES(medical_other), allergies = VALUES(allergies), allergy_other = VALUES(allergy_other), consent = VALUES(consent), completed = VALUES(completed), submitted_by = VALUES(submitted_by), updated_at = NOW()');
        $dentalConcern = json_encode($medical['dentalConcern'] ?? []);
        $dentalConcernOther = (string) ($medical['dentalConcernOther'] ?? '');
        $negativeExperience = (string) ($medical['negativeExperience'] ?? 'No');
        $negativeExperienceNote = (string) ($medical['negativeExperienceNote'] ?? '');
        $lastVisit = (string) ($medical['medLastVisit'] ?? '');
        $lastTreatment = (string) ($medical['medLastTreatment'] ?? '');
        $currentMedications = (string) ($medical['currentMedications'] ?? 'No');
        $medicationList = (string) ($medical['currentMedicationsList'] ?? '');
        $medicalHistory = json_encode($medical['medicalHistory'] ?? []);
        $medicalOther = (string) ($medical['medicalOther'] ?? '');
        $allergies = json_encode($medical['allergies'] ?? []);
        $allergyOther = (string) ($medical['allergyOther'] ?? '');
        $consent = !empty($medical['consent']) ? 1 : 0;
        $completed = !empty($medical['completed']) ? 1 : 0;
        $stmt->bind_param('sssssssssssssiii', $patientId, $dentalConcern, $dentalConcernOther, $negativeExperience, $negativeExperienceNote, $lastVisit, $lastTreatment, $currentMedications, $medicationList, $medicalHistory, $medicalOther, $allergies, $allergyOther, $consent, $completed, $userId);
        $stmt->execute();
        $stmt->close();
    }

        if ($role === 'doctor' && is_array($patient)) {
            if (array_key_exists('treatments', $patient)) {
                $treatmentStmt = $conn->prepare(
                    'INSERT INTO tbl_patient_treatments (
                        patient_id,
                        appointment_id,
                        doctor_id,
                        tooth_number,
                        procedure_name,
                        treatment_date,
                        notes,
                        consumed_materials
                    ) VALUES (
                        ?,
                        NULLIF(?, ""),
                        ?,
                        ?,
                        ?,
                        NULLIF(?, ""),
                        ?,
                        ?
                    )'
                );

                if (!$treatmentStmt) {
                    throw new RuntimeException(
                        'Unable to prepare treatment insert statement.'
                    );
                }

                $updateTreatmentStmt = $conn->prepare(
                    'UPDATE tbl_patient_treatments
                    SET
                        appointment_id = NULLIF(?, ""),
                        doctor_id = ?,
                        tooth_number = ?,
                        procedure_name = ?,
                        treatment_date = NULLIF(?, ""),
                        notes = ?,
                        consumed_materials = ?
                    WHERE treatment_id = ?
                    AND patient_id = ?'
                );

                if (!$updateTreatmentStmt) {
                    throw new RuntimeException(
                        'Unable to prepare treatment update statement.'
                    );
                }

                foreach (
                    is_array($patient['treatments'])
                        ? $patient['treatments']
                        : []
                    as $treatment
                ) {
                    $treatmentId = (int) (
                        $treatment['treatmentId']
                        ?? $treatment['treatment_id']
                        ?? $treatment['id']
                        ?? 0
                    );

                    $appointmentId = (string) (
                        $treatment['appointmentId']
                        ?? $treatment['appointment_id']
                        ?? ''
                    );

                    $appointmentIdInt = $appointmentId !== ''
                        ? (int) $appointmentId
                        : 0;

                    $doctorId = (int) $userId;

                    $toothNumber = (string) (
                        $treatment['toothNumber']
                        ?? $treatment['tooth']
                        ?? ''
                    );

                    $procedureName = (string) (
                        $treatment['procedure']
                        ?? $treatment['treatment']
                        ?? 'Dental Treatment'
                    );

                    $treatmentDate = (string) (
                        $treatment['date']
                        ?? $treatment['treatmentDate']
                        ?? $treatment['createdAt']
                        ?? ''
                    );

                    $treatmentNotes = (string) (
                        $treatment['note']
                        ?? $treatment['notes']
                        ?? ''
                    );

                    $consumedMaterials = json_encode(
                        $treatment['consumedMaterials'] ?? [],
                        JSON_UNESCAPED_UNICODE
                    );

                    $savedTreatmentId = 0;

                    if ($treatmentId > 0) {
                        $updateTreatmentStmt->bind_param(
                            'sisssssis',
                            $appointmentId,
                            $doctorId,
                            $toothNumber,
                            $procedureName,
                            $treatmentDate,
                            $treatmentNotes,
                            $consumedMaterials,
                            $treatmentId,
                            $patientId
                        );

                        if (!$updateTreatmentStmt->execute()) {
                            throw new RuntimeException(
                                'Unable to update treatment: ' .
                                $updateTreatmentStmt->error
                            );
                        }

                        if ($updateTreatmentStmt->affected_rows === 0) {
                            $checkTreatmentStmt = $conn->prepare(
                                'SELECT treatment_id
                                FROM tbl_patient_treatments
                                WHERE treatment_id = ?
                                AND patient_id = ?
                                LIMIT 1'
                            );

                            if (!$checkTreatmentStmt) {
                                throw new RuntimeException(
                                    'Unable to verify existing treatment.'
                                );
                            }

                            $checkTreatmentStmt->bind_param(
                                'is',
                                $treatmentId,
                                $patientId
                            );

                            $checkTreatmentStmt->execute();

                            $existingTreatment =
                                $checkTreatmentStmt
                                    ->get_result()
                                    ->fetch_assoc();

                            $checkTreatmentStmt->close();

                            if (!$existingTreatment) {
                                $treatmentId = 0;
                            }
                        }

                        if ($treatmentId > 0) {
                            $savedTreatmentId = $treatmentId;
                        }
                    }

                    if ($savedTreatmentId === 0) {
                        $treatmentStmt->bind_param(
                            'ssisssss',
                            $patientId,
                            $appointmentId,
                            $doctorId,
                            $toothNumber,
                            $procedureName,
                            $treatmentDate,
                            $treatmentNotes,
                            $consumedMaterials
                        );

                        if (!$treatmentStmt->execute()) {
                            throw new RuntimeException(
                                'Unable to save treatment: ' .
                                $treatmentStmt->error
                            );
                        }

                        $savedTreatmentId = (int) $conn->insert_id;
                    }

                    if ($appointmentId !== '') {
                        $appointmentStmt = $conn->prepare(
                            'SELECT status
                            FROM tbl_patient_appointments
                            WHERE appointment_id = ?
                            LIMIT 1'
                        );

                        if (!$appointmentStmt) {
                            throw new RuntimeException(
                                'Unable to prepare appointment status lookup.'
                            );
                        }

                        $appointmentIdInt = (int) $appointmentId;

                        $appointmentStmt->bind_param(
                            'i',
                            $appointmentIdInt
                        );

                        $appointmentStmt->execute();

                        $appointmentResult =
                            $appointmentStmt->get_result();

                        $appointmentRow =
                            $appointmentResult->fetch_assoc();

                        $appointmentStmt->close();

                        $appointmentStatus = strtolower(
                            trim(
                                (string) (
                                    $appointmentRow['status']
                                    ?? ''
                                )
                            )
                        );

                        if (
                            $appointmentStatus !== 'completed' &&
                            $appointmentStatus !== 'complete'
                        ) {
                            continue;
                        }
                    }

                    $forecastNeeded = true;

                    $materials =
                        $treatment['consumedMaterials'] ?? [];

                    if (!is_array($materials)) {
                        continue;
                    }

                    foreach ($materials as $material) {
                        if (!is_array($material)) {
                            continue;
                        }

                        $itemId = (int) (
                            $material['itemId']
                            ?? $material['item_id']
                            ?? 0
                        );

                        $itemName = trim(
                            (string) (
                                $material['itemName']
                                ?? $material['item_name']
                                ?? $material['name']
                                ?? ''
                            )
                        );

                        $quantity = (float) (
                            $material['quantity']
                            ?? $material['qty']
                            ?? $material['used']
                            ?? $material['amount']
                            ?? $material['consumed']
                            ?? 0
                        );

                        if ($quantity <= 0) {
                            continue;
                        }

                        if ($itemId > 0) {
                            $itemStmt = $conn->prepare(
                                'SELECT
                                    item_id,
                                    item_name,
                                    stock_quantity,
                                    unit
                                FROM tbl_inventory_items
                                WHERE item_id = ?
                                LIMIT 1'
                            );

                            if (!$itemStmt) {
                                throw new RuntimeException(
                                    'Unable to prepare inventory item lookup.'
                                );
                            }

                            $itemStmt->bind_param(
                                'i',
                                $itemId
                            );
                        } else {
                            $itemStmt = $conn->prepare(
                                'SELECT
                                    item_id,
                                    item_name,
                                    stock_quantity,
                                    unit
                                FROM tbl_inventory_items
                                WHERE LOWER(item_name) = LOWER(?)
                                LIMIT 1'
                            );

                            if (!$itemStmt) {
                                throw new RuntimeException(
                                    'Unable to prepare inventory item lookup.'
                                );
                            }

                            $itemStmt->bind_param(
                                's',
                                $itemName
                            );
                        }

                        $itemStmt->execute();

                        $itemResult =
                            $itemStmt->get_result();

                        $inventoryItem =
                            $itemResult->fetch_assoc();

                        $itemStmt->close();

                        if (!$inventoryItem) {
                            throw new RuntimeException(
                                'Inventory item not found: ' .
                                ($itemName !== ''
                                    ? $itemName
                                    : 'ID ' . $itemId)
                            );
                        }

                        $inventoryItemId =
                            (int) $inventoryItem['item_id'];

                        $inventoryItemName =
                            (string) $inventoryItem['item_name'];

                        $previousStock =
                            (float) (
                                $inventoryItem['stock_quantity']
                                ?? 0
                            );

                        $unit =
                            (string) (
                                $inventoryItem['unit']
                                ?? 'unit'
                            );

                        $treatmentKey = hash(
                            'sha256',
                            'treatment|' . $savedTreatmentId
                        );

                        $usageCheckStmt = $conn->prepare(
                            'SELECT usage_id
                            FROM tbl_inventory_treatment_usage
                            WHERE treatment_id = ?
                            AND item_id = ?
                            LIMIT 1'
                        );

                        if (!$usageCheckStmt) {
                            throw new RuntimeException(
                                'Unable to prepare treatment usage lookup.'
                            );
                        }

                        $usageCheckStmt->bind_param(
                            'ii',
                            $savedTreatmentId,
                            $inventoryItemId
                        );

                        $usageCheckStmt->execute();

                        $usageResult =
                            $usageCheckStmt->get_result();

                        $alreadyProcessed =
                            $usageResult->fetch_assoc();

                        $usageCheckStmt->close();

                        if ($alreadyProcessed) {
                            continue;
                        }
                        
                        if ($quantity > $previousStock) {
                            throw new RuntimeException(
                                'Insufficient stock for ' .
                                $inventoryItemName .
                                '. Available: ' .
                                $previousStock .
                                ' ' .
                                $unit .
                                '. Required: ' .
                                $quantity .
                                ' ' .
                                $unit .
                                '.'
                            );
                        }

                        $newStock =
                            $previousStock - $quantity;

                        $updateStockStmt = $conn->prepare(
                            'UPDATE tbl_inventory_items
                            SET stock_quantity = ?,
                                updated_at = NOW()
                            WHERE item_id = ?'
                        );

                        if (!$updateStockStmt) {
                            throw new RuntimeException(
                                'Unable to prepare inventory stock update.'
                            );
                        }

                        $updateStockStmt->bind_param(
                            'di',
                            $newStock,
                            $inventoryItemId
                        );

                        if (!$updateStockStmt->execute()) {
                            throw new RuntimeException(
                                'Unable to update inventory stock: ' .
                                $updateStockStmt->error
                            );
                        }

                        $updateStockStmt->close();

                        $movementSource =
                            'Completed treatment';

                        $movementType =
                            'stock-out';

                        $movementStmt = $conn->prepare(
                            'INSERT INTO tbl_inventory_movements (
                                item_id,
                                item_name,
                                movement_type,
                                quantity,
                                unit,
                                previous_stock,
                                new_stock,
                                source,
                                appointment_id,
                                patient_id,
                                movement_date
                            ) VALUES (
                                ?,
                                ?,
                                ?,
                                ?,
                                ?,
                                ?,
                                ?,
                                ?,
                                NULLIF(?, 0),
                                ?,
                                NOW()
                            )'
                        );

                        if (!$movementStmt) {
                            throw new RuntimeException(
                                'Unable to prepare inventory movement insert.'
                            );
                        }

                        $movementStmt->bind_param(
                            'issdsddsis',
                            $inventoryItemId,
                            $inventoryItemName,
                            $movementType,
                            $quantity,
                            $unit,
                            $previousStock,
                            $newStock,
                            $movementSource,
                            $appointmentIdInt,
                            $patientId
                        );

                        if (!$movementStmt->execute()) {
                            throw new RuntimeException(
                                'Unable to create inventory movement: ' .
                                $movementStmt->error
                            );
                        }

                        $movementStmt->close();

                        $usageStmt = $conn->prepare(
                            'INSERT INTO tbl_inventory_treatment_usage (
                                treatment_id,
                                treatment_key,
                                item_id,
                                quantity
                            ) VALUES (?, ?, ?, ?)'
                        );

                        if (!$usageStmt) {
                            throw new RuntimeException(
                                'Unable to prepare treatment usage insert.'
                            );
                        }

                        $usageStmt->bind_param(
                            'isid',
                            $savedTreatmentId,
                            $treatmentKey,
                            $inventoryItemId,
                            $quantity
                        );

                        if (!$usageStmt->execute()) {
                            throw new RuntimeException(
                                'Unable to record treatment inventory usage: ' .
                                $usageStmt->error
                            );
                        }

                        $usageStmt->close();
                    }
                }

                $treatmentStmt->close();
                $updateTreatmentStmt->close();
            }
        }

        if (isset($patient['dentalChart']['teeth']) && is_array($patient['dentalChart']['teeth'])) {
            $conn->query("DELETE FROM tbl_dental_chart WHERE patient_id = '" . $conn->real_escape_string($patientId) . "'");
            $stmt = $conn->prepare('INSERT INTO tbl_dental_chart (patient_id, tooth_number, procedure_name, notes, recorded_at) VALUES (?, ?, ?, ?, COALESCE(NULLIF(?, ""), NOW()))');
            foreach ($patient['dentalChart']['teeth'] as $toothNumber => $tooth) {
                if (!is_array($tooth)) {
                    continue;
                }
                $procedureName = (string) ($tooth['procedure'] ?? '');
                $toothNotes = (string) ($tooth['note'] ?? $tooth['notes'] ?? '');
                if ($procedureName === '' && $toothNotes === '') {
                    continue;
                }
                $recordedAt = (string) ($tooth['updatedAt'] ?? '');
                $toothNumber = (string) $toothNumber;
                $stmt->bind_param('sssss', $patientId, $toothNumber, $procedureName, $toothNotes, $recordedAt);
                $stmt->execute();
            }
            $stmt->close();
        }
    $conn->commit();

    if ($forecastNeeded) {
        triggerInventoryForecast();
    }

} catch (Throwable $exception) {
    $conn->rollback();
    error_log('Patient record save error: ' . $exception->getMessage());

    jsonResponse(
        false,
        'Unable to save patient record. Please try again.',
        null,
        500
    );
}

jsonResponse(
    true,
    'Patient record saved.',
    patientPayload($conn, $patientId)
);