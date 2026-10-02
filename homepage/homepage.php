<?php

require_once "../php/db_connect.php";

header("Content-Type: application/json");

echo json_encode([
    "success" => true,
    "message" => "Homepage PHP is connected to the database.",
    "database" => $database
]);

$conn->close();

?>