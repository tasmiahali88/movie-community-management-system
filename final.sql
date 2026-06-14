-- ==========================================================
-- SECTION 1: TABLES & SCHEMA
-- ==========================================================

DROP DATABASE IF EXISTS MovieCommunityDB;
CREATE DATABASE MovieCommunityDB;
USE MovieCommunityDB;

CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    profile_picture LONGBLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE TABLE Admins (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('super_admin', 'content_moderator') DEFAULT 'content_moderator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE FriendRequests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    CONSTRAINT uk_unique_friend_request UNIQUE (sender_id, receiver_id)
);

CREATE TABLE Friendships (
    friendship_id INT PRIMARY KEY AUTO_INCREMENT,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    became_friends_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    CONSTRAINT uk_friendship UNIQUE (user1_id, user2_id)
);

CREATE TABLE Genres (
    genre_id INT PRIMARY KEY AUTO_INCREMENT,
    genre_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE Movies (
    movie_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    synopsis TEXT,
    release_year INT,
    poster_image VARCHAR(500),
    duration_minutes INT,
    created_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES Admins(admin_id)
);

CREATE TABLE MovieGenres (
    movie_genre_id INT PRIMARY KEY AUTO_INCREMENT,
    movie_id INT NOT NULL,
    genre_id INT NOT NULL,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES Genres(genre_id) ON DELETE CASCADE,
    CONSTRAINT uk_movie_genre UNIQUE (movie_id, genre_id)
);

CREATE TABLE Watchlist (
    watchlist_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    movie_id INT NOT NULL,
    status ENUM('to-watch', 'watching', 'completed') DEFAULT 'to-watch',
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE,
    CONSTRAINT uk_user_movie_watchlist UNIQUE (user_id, movie_id)
);

CREATE TABLE Reviews (
    review_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    movie_id INT NOT NULL,
    review_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    is_edited BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE,
    CONSTRAINT uk_user_movie_review UNIQUE (user_id, movie_id)
);

CREATE TABLE Ratings (
    rating_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    movie_id INT NOT NULL,
    rating_value INT NOT NULL,
    rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE,
    CONSTRAINT uk_user_movie_rating UNIQUE (user_id, movie_id),
    CONSTRAINT chk_rating_value CHECK (rating_value BETWEEN 1 AND 10)
);

CREATE TABLE History (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    movie_id INT NOT NULL,
    action_type ENUM('added_to_watchlist', 'status_changed', 'completed', 'removed') NOT NULL,
    action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status_before ENUM('to-watch', 'watching', 'completed'),
    status_after ENUM('to-watch', 'watching', 'completed'),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE
);

CREATE TABLE DiscussionForums (
    forum_id INT PRIMARY KEY AUTO_INCREMENT,
    movie_id INT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_posts INT DEFAULT 0,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE
);

CREATE TABLE Posts (
    post_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    forum_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'flagged', 'removed', 'under_review') DEFAULT 'active',
    flag_count INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (forum_id) REFERENCES DiscussionForums(forum_id) ON DELETE CASCADE
);

CREATE TABLE Comments (
    comment_id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'flagged', 'removed', 'under_review') DEFAULT 'active',
    FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Likes (
    like_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT,
    comment_id INT,
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES Comments(comment_id) ON DELETE CASCADE,
    CONSTRAINT chk_like_target CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),
    CONSTRAINT uk_user_post_like UNIQUE (user_id, post_id),
    CONSTRAINT uk_user_comment_like UNIQUE (user_id, comment_id)
);

CREATE TABLE Notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    sender_id INT NOT NULL,
    type ENUM('friend_request', 'like', 'comment', 'event_invite') NOT NULL,
    reference_id INT,
    message TEXT NOT NULL,
    is_seen BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (CURRENT_TIMESTAMP + INTERVAL 1 DAY),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Events (
    event_id INT PRIMARY KEY AUTO_INCREMENT,
    host_id INT NOT NULL,
    movie_id INT NOT NULL,
    event_title VARCHAR(255) NOT NULL,
    description TEXT,
    event_datetime DATETIME NOT NULL,
    max_participants INT,
    current_participants INT DEFAULT 0,
    status ENUM('scheduled', 'ongoing', 'completed', 'cancelled') DEFAULT 'scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE
);

CREATE TABLE EventParticipation (
    participation_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    event_id INT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('joined', 'attended', 'cancelled') DEFAULT 'joined',
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Events(event_id) ON DELETE CASCADE,
    CONSTRAINT uk_user_event UNIQUE (user_id, event_id)
);

CREATE TABLE PrivateMessages (
    message_id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    content TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE RestrictedWords (
    word_id INT PRIMARY KEY AUTO_INCREMENT,
    restricted_word VARCHAR(100) UNIQUE NOT NULL,
    added_by INT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (added_by) REFERENCES Admins(admin_id)
);

CREATE TABLE Reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    generated_by INT NOT NULL,
    report_type ENUM('most_watched', 'highest_rated', 'most_active_users', 'popular_forums') NOT NULL,
    report_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    parameters JSON,
    results_json JSON,
    FOREIGN KEY (generated_by) REFERENCES Admins(admin_id)
);

CREATE TABLE AuditLog (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_table VARCHAR(50) NOT NULL,
    target_record_id INT,
    action_details TEXT,
    ip_address VARCHAR(45),
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES Admins(admin_id)
);

CREATE TABLE UserActivity (
    user_id INT PRIMARY KEY,
    total_posts INT DEFAULT 0,
    total_comments INT DEFAULT 0,
    total_reviews INT DEFAULT 0,
    total_events_hosted INT DEFAULT 0,
    total_watched_movies INT DEFAULT 0,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE MovieStatistics (
    movie_id INT PRIMARY KEY,
    average_rating DECIMAL(4,2) DEFAULT 0.00,  -- FIXED: Changed to (4,2) to allow 10.00
    total_reviews_stored INT DEFAULT 0,
    total_watchlist_adds INT DEFAULT 0,
    total_completions INT DEFAULT 0,
    total_forum_posts INT DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES Movies(movie_id) ON DELETE CASCADE
);

CREATE TABLE UserFavoriteGenres (
    user_genre_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    genre_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES Genres(genre_id) ON DELETE CASCADE,
    CONSTRAINT uk_user_genre UNIQUE (user_id, genre_id)
);

-- ==========================================================
-- SECTION 2: VIEWS
-- ==========================================================

CREATE VIEW MovieRatingsSummary AS
SELECT 
    m.movie_id,
    m.title,
    COUNT(r.rating_id) as total_ratings,
    COALESCE(AVG(r.rating_value), 0) as average_rating,
    COUNT(rev.review_id) as total_reviews
FROM Movies m
LEFT JOIN Ratings r ON m.movie_id = r.movie_id
LEFT JOIN Reviews rev ON m.movie_id = rev.movie_id
GROUP BY m.movie_id, m.title;

CREATE VIEW CompleteMovieStats AS
SELECT 
    m.movie_id,
    m.title,
    m.release_year,
    (SELECT COUNT(*) FROM Ratings r WHERE r.movie_id = m.movie_id) as total_ratings,
    (SELECT COALESCE(AVG(rating_value), 0) FROM Ratings r WHERE r.movie_id = m.movie_id) as average_rating,
    (SELECT COUNT(*) FROM Reviews rev WHERE rev.movie_id = m.movie_id) as total_reviews,
    COALESCE(ms.total_watchlist_adds, 0) as total_watchlist_adds,
    COALESCE(ms.total_completions, 0) as total_completions,
    COALESCE(ms.total_forum_posts, 0) as total_forum_posts
FROM Movies m
LEFT JOIN MovieStatistics ms ON m.movie_id = ms.movie_id;

CREATE OR REPLACE VIEW View_Top10_Watched AS
SELECT 
    m.title, 
    m.release_year, 
    COUNT(w.user_id) as completion_count
FROM Movies m
JOIN Watchlist w ON m.movie_id = w.movie_id
WHERE w.status = 'completed'
GROUP BY m.movie_id
ORDER BY completion_count DESC
LIMIT 10;

CREATE OR REPLACE VIEW View_Most_Active_Users AS
SELECT 
    u.user_id, 
    u.name, 
    COUNT(p.post_id) as total_posts
FROM Users u
JOIN Posts p ON u.user_id = p.user_id
GROUP BY u.user_id
ORDER BY total_posts DESC;

-- ==========================================================
-- SECTION 3: TRIGGERS
-- ==========================================================

DELIMITER //

CREATE TRIGGER validate_release_year_insert
BEFORE INSERT ON Movies
FOR EACH ROW
BEGIN
    IF NEW.release_year IS NOT NULL AND (NEW.release_year < 1900 OR NEW.release_year > YEAR(CURRENT_DATE) + 5) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Release year must be between 1900 and current year + 5';
    END IF;
END//

CREATE TRIGGER validate_release_year_update
BEFORE UPDATE ON Movies
FOR EACH ROW
BEGIN
    IF NEW.release_year IS NOT NULL AND (NEW.release_year < 1900 OR NEW.release_year > YEAR(CURRENT_DATE) + 5) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Release year must be between 1900 and current year + 5';
    END IF;
END//

CREATE TRIGGER create_discussion_forum
AFTER INSERT ON Movies
FOR EACH ROW
BEGIN
    INSERT INTO DiscussionForums (movie_id) VALUES (NEW.movie_id);
    INSERT INTO MovieStatistics (movie_id) VALUES (NEW.movie_id);
END//

CREATE TRIGGER handle_friend_request_accept
AFTER UPDATE ON FriendRequests
FOR EACH ROW
BEGIN
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        INSERT INTO Friendships (user1_id, user2_id) 
        VALUES (LEAST(NEW.sender_id, NEW.receiver_id), GREATEST(NEW.sender_id, NEW.receiver_id));
    END IF;
END//

CREATE TRIGGER validate_private_message
BEFORE INSERT ON PrivateMessages
FOR EACH ROW
BEGIN
    DECLARE are_friends INT;
    SELECT COUNT(*) INTO are_friends FROM Friendships 
    WHERE (user1_id = LEAST(NEW.sender_id, NEW.receiver_id) AND user2_id = GREATEST(NEW.sender_id, NEW.receiver_id));
    
    IF are_friends = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Users must be friends to send private messages';
    END IF;
END//

CREATE TRIGGER prevent_overlapping_host_events
BEFORE INSERT ON Events
FOR EACH ROW
BEGIN
    DECLARE overlapping_events INT;
    SELECT COUNT(*) INTO overlapping_events FROM Events 
    WHERE host_id = NEW.host_id 
    AND event_datetime = NEW.event_datetime 
    AND status != 'cancelled';
    
    IF overlapping_events > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User cannot host overlapping events';
    END IF;
END//

CREATE TRIGGER prevent_overlapping_participant_events
BEFORE INSERT ON EventParticipation
FOR EACH ROW
BEGIN
    DECLARE overlapping_events INT;
    SELECT COUNT(*) INTO overlapping_events FROM EventParticipation ep
    JOIN Events e ON ep.event_id = e.event_id
    WHERE ep.user_id = NEW.user_id 
    AND e.event_datetime = (SELECT event_datetime FROM Events WHERE event_id = NEW.event_id)
    AND e.status != 'cancelled';
    
    IF overlapping_events > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User cannot participate in overlapping events';
    END IF;
END//

CREATE TRIGGER update_watch_history_from_events
AFTER UPDATE ON Events
FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO Watchlist (user_id, movie_id, status, added_at, updated_at)
        SELECT ep.user_id, NEW.movie_id, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM EventParticipation ep
        WHERE ep.event_id = NEW.event_id AND ep.status = 'joined'
        ON DUPLICATE KEY UPDATE status = 'completed', updated_at = CURRENT_TIMESTAMP;
        
        INSERT INTO History (user_id, movie_id, action_type, status_before, status_after)
        SELECT ep.user_id, NEW.movie_id, 'completed', 'to-watch', 'completed'
        FROM EventParticipation ep
        WHERE ep.event_id = NEW.event_id AND ep.status = 'joined';
    END IF;
END//

CREATE TRIGGER flag_content_with_restricted_words
BEFORE INSERT ON Posts
FOR EACH ROW
BEGIN
    DECLARE restricted_count INT;
    SELECT COUNT(*) INTO restricted_count FROM RestrictedWords 
    WHERE is_active = TRUE AND NEW.content LIKE CONCAT('%', restricted_word, '%');
    
    IF restricted_count > 0 THEN
        SET NEW.status = 'under_review';
        SET NEW.flag_count = restricted_count;
    END IF;
END//

CREATE TRIGGER flag_comments_with_restricted_words
BEFORE INSERT ON Comments
FOR EACH ROW
BEGIN
    DECLARE restricted_count INT;
    SELECT COUNT(*) INTO restricted_count FROM RestrictedWords 
    WHERE is_active = TRUE AND NEW.content LIKE CONCAT('%', restricted_word, '%');
    
    IF restricted_count > 0 THEN
        SET NEW.status = 'under_review';
    END IF;
END//

CREATE TRIGGER log_admin_movie_actions
AFTER INSERT ON Movies
FOR EACH ROW
BEGIN
    INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details)
    VALUES (NEW.created_by, 'INSERT', 'Movies', NEW.movie_id, CONCAT('Created movie: ', NEW.title));
END//

CREATE TRIGGER log_admin_moderation_actions
AFTER UPDATE ON Posts
FOR EACH ROW
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('removed', 'active') THEN
        INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details)
        VALUES (1, CONCAT('MODERATE_', UPPER(NEW.status)), 'Posts', NEW.post_id, CONCAT('Moderated post ID: ', NEW.post_id));
    END IF;
END//

DELIMITER ;

-- ==========================================================
-- SECTION 4: STORED PROCEDURES & FUNCTIONS
-- ==========================================================

DELIMITER //

CREATE PROCEDURE sp_AddReview(
    IN p_user_id INT,
    IN p_movie_id INT,
    IN p_rating INT,
    IN p_review_text TEXT
)
BEGIN
    DECLARE new_avg DECIMAL(4,2); -- FIXED: Changed from (3,2) to (4,2) to handle 10.00

    INSERT INTO Reviews (user_id, movie_id, review_text) 
    VALUES (p_user_id, p_movie_id, p_review_text);

    INSERT INTO Ratings (user_id, movie_id, rating_value)
    VALUES (p_user_id, p_movie_id, p_rating)
    ON DUPLICATE KEY UPDATE rating_value = p_rating, rated_at = NOW();

    SELECT AVG(rating_value) INTO new_avg
    FROM Ratings
    WHERE movie_id = p_movie_id;

    INSERT INTO MovieStatistics (movie_id, average_rating, total_reviews_stored)
    VALUES (p_movie_id, new_avg, 1)
    ON DUPLICATE KEY UPDATE 
        average_rating = new_avg,
        total_reviews_stored = total_reviews_stored + 1;
END //

CREATE FUNCTION fn_CalculateFriendCompatibility(userA INT, userB INT) 
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE shared_interest_count INT;
    
    SELECT COUNT(*) INTO shared_interest_count
    FROM Watchlist w1
    JOIN Watchlist w2 ON w1.movie_id = w2.movie_id
    WHERE w1.user_id = userA AND w2.user_id = userB;
    
    RETURN shared_interest_count;
END //

DELIMITER ;

-- ==========================================================
-- SECTION 5: INDEXES
-- ==========================================================

CREATE INDEX idx_users_email ON Users(email);
CREATE INDEX idx_users_last_login ON Users(last_login);
CREATE INDEX idx_movies_title ON Movies(title);
CREATE INDEX idx_movies_release_year ON Movies(release_year);
CREATE INDEX idx_watchlist_user_status ON Watchlist(user_id, status);
CREATE INDEX idx_watchlist_movie ON Watchlist(movie_id);
CREATE INDEX idx_reviews_user ON Reviews(user_id);
CREATE INDEX idx_reviews_movie ON Reviews(movie_id);
CREATE INDEX idx_ratings_movie ON Ratings(movie_id);
CREATE INDEX idx_posts_forum ON Posts(forum_id);
CREATE INDEX idx_posts_user ON Posts(user_id);
CREATE INDEX idx_comments_post ON Comments(post_id);
CREATE INDEX idx_comments_user ON Comments(user_id);
CREATE INDEX idx_events_datetime ON Events(event_datetime);
CREATE INDEX idx_events_host ON Events(host_id);
CREATE INDEX idx_events_movie ON Events(movie_id);
CREATE INDEX idx_messages_sender ON PrivateMessages(sender_id);
CREATE INDEX idx_messages_receiver ON PrivateMessages(receiver_id);
CREATE INDEX idx_messages_sent_at ON PrivateMessages(sent_at);
CREATE INDEX idx_notifications_user ON Notifications(user_id);
CREATE INDEX idx_notifications_seen ON Notifications(is_seen);
CREATE INDEX idx_friendships_user1 ON Friendships(user1_id);
CREATE INDEX idx_friendships_user2 ON Friendships(user2_id);

-- ==========================================================
-- SECTION 6: DATA INSERTION
-- ==========================================================

INSERT INTO Genres (genre_name, description) VALUES 
('Action', 'High-energy films with physical stunts and chases'),
('Drama', 'Serious, plot-driven stories portraying realistic characters'),
('Comedy', 'Light-hearted stories designed to amuse and entertain'),
('Sci-Fi', 'Futuristic speculative fiction with scientific elements'),
('Horror', 'Films designed to frighten and panic viewers');

-- Use INSERT IGNORE to prevent duplicate errors on re-runs
INSERT IGNORE INTO Admins (username, password_hash, email, name, role) VALUES 
('sysadmin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@moviecommunity.com', 'System Administrator', 'super_admin');

INSERT IGNORE INTO Users (email, password_hash, name) VALUES 
('user1@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John Doe'),
('user2@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Jane Smith');

-- ==========================================================
-- SECTION 7: PERMISSIONS (Optional/Local)
-- ==========================================================

DROP ROLE IF EXISTS 'app_admin_role';
DROP ROLE IF EXISTS 'app_user_role';
CREATE ROLE 'app_admin_role';
CREATE ROLE 'app_user_role';

GRANT ALL PRIVILEGES ON MovieCommunityDB.* TO 'app_admin_role';

GRANT SELECT ON MovieCommunityDB.Movies TO 'app_user_role';
GRANT SELECT ON MovieCommunityDB.Posts TO 'app_user_role';
GRANT INSERT, UPDATE ON MovieCommunityDB.Reviews TO 'app_user_role';
GRANT INSERT, UPDATE ON MovieCommunityDB.Watchlist TO 'app_user_role';

CREATE USER IF NOT EXISTS 'admin_user'@'localhost' IDENTIFIED BY '1234';
CREATE USER IF NOT EXISTS 'general_user'@'localhost' IDENTIFIED BY '1234';

GRANT 'app_admin_role' TO 'admin_user'@'localhost';
GRANT 'app_user_role' TO 'general_user'@'localhost';

FLUSH PRIVILEGES;

COMMIT;