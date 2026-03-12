<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$db_host = '127.0.0.1'; // Localhost since PHP runs on Hostinger
$db_user = 'u915773746_wikiadmin';
$db_pass = 'G0ttaloveISV@';
$db_name = 'u915773746_wiki';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    die(json_encode(['error' => 'Connection failed']));
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'getStats') {
    // 1. Fetch Users
    $users_sql = "SELECT username, edits, articles_created as articlesCreated, pages_created as pagesCreated, volume_added as volumeAdded FROM users ORDER BY edits DESC";
    $users_result = $conn->query($users_sql);
    $users = [];
    if ($users_result->num_rows > 0) {
        while($row = $users_result->fetch_assoc()) {
            // Cast numeric strings back to ints
            $row['edits'] = (int)$row['edits'];
            $row['articlesCreated'] = (int)$row['articlesCreated'];
            $row['pagesCreated'] = (int)$row['pagesCreated'];
            $row['volumeAdded'] = (int)$row['volumeAdded'];
            $users[] = $row;
        }
    }

    // 2. Fetch Calendar
    $calendar_sql = "SELECT month_year as month, active_users as activeUsers, active_users_10plus as activeUsers10Plus FROM calendar_months ORDER BY month_year DESC";
    $calendar_result = $conn->query($calendar_sql);
    $calendar = [];
    if ($calendar_result->num_rows > 0) {
        while($row = $calendar_result->fetch_assoc()) {
            $row['activeUsers'] = json_decode($row['activeUsers']);
            $row['activeUsers10Plus'] = (int)$row['activeUsers10Plus'];
            
            // Re-attach new articles for this month
            $monthStart = $row['month'] . '-01T00:00:00Z';
            $monthEnd = $row['month'] . '-31T23:59:59Z'; // generous end
            $art_sql = "SELECT title, author, size, created_date as timestamp, last_modified_date FROM articles WHERE created_date >= '$monthStart' AND created_date <= '$monthEnd'";
            $art_result = $conn->query($art_sql);
            $newArticles = [];
            if ($art_result && $art_result->num_rows > 0) {
                while($artRow = $art_result->fetch_assoc()) {
                    $artRow['size'] = (int)$artRow['size'];
                    $newArticles[] = $artRow;
                }
            }
            $row['newArticles'] = $newArticles;
            $calendar[] = $row;
        }
    }

    echo json_encode([
        'users' => $users,
        'calendar' => $calendar
    ]);
} else {
    echo json_encode(['error' => 'Invalid action']);
}

$conn->close();
?>
