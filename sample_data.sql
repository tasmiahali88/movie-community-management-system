CREATE DATABASE IF NOT EXISTS MovieCommunityDB;
USE MovieCommunityDB;

-- ----------------------------------------------------------------------
-- 1. Table Creations
-- ----------------------------------------------------------------------

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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
    admin_id INT,
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

-- ----------------------------------------------------------------------
-- 2. Views
-- ----------------------------------------------------------------------

CREATE VIEW MovieRatingsSummary AS
SELECT
    m.movie_id,
    m.title,
    COUNT(r.rating_id) AS total_ratings,
    COALESCE(AVG(r.rating_value), 0) AS average_rating,
    COUNT(rev.review_id) AS total_reviews
FROM Movies m
LEFT JOIN Ratings r ON m.movie_id = r.movie_id
LEFT JOIN Reviews rev ON m.movie_id = rev.movie_id
GROUP BY m.movie_id, m.title;

CREATE VIEW CompleteMovieStats AS
SELECT
    m.movie_id,
    m.title,
    m.release_year,
    (SELECT COUNT(*) FROM Ratings r WHERE r.movie_id = m.movie_id) AS total_ratings,
    (SELECT COALESCE(AVG(rating_value), 0) FROM Ratings r WHERE r.movie_id = m.movie_id) AS average_rating,
    (SELECT COUNT(*) FROM Reviews rev WHERE rev.movie_id = m.movie_id) AS total_reviews,
    COALESCE(ms.total_watchlist_adds, 0) AS total_watchlist_adds,
    COALESCE(ms.total_completions, 0) AS total_completions,
    COALESCE(ms.total_forum_posts, 0) AS total_forum_posts
FROM Movies m
LEFT JOIN MovieStatistics ms ON m.movie_id = ms.movie_id;

-- ----------------------------------------------------------------------
-- 3. Triggers
-- ----------------------------------------------------------------------

DELIMITER //

CREATE TRIGGER validate_release_year_insert
BEFORE INSERT ON Movies FOR EACH ROW
BEGIN
    IF NEW.release_year IS NOT NULL
       AND (NEW.release_year < 1900 OR NEW.release_year > YEAR(CURRENT_DATE) + 5) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Release year must be between 1900 and current year + 5';
    END IF;
END//

CREATE TRIGGER validate_release_year_update
BEFORE UPDATE ON Movies FOR EACH ROW
BEGIN
    IF NEW.release_year IS NOT NULL
       AND (NEW.release_year < 1900 OR NEW.release_year > YEAR(CURRENT_DATE) + 5) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Release year must be between 1900 and current year + 5';
    END IF;
END//

CREATE TRIGGER create_discussion_forum
AFTER INSERT ON Movies FOR EACH ROW
BEGIN
    INSERT INTO DiscussionForums (movie_id) VALUES (NEW.movie_id);
END//

CREATE TRIGGER handle_friend_request_accept_insert
AFTER INSERT ON FriendRequests FOR EACH ROW
BEGIN
    IF NEW.status = 'accepted' THEN
        INSERT INTO Friendships (user1_id, user2_id)
        VALUES (LEAST(NEW.sender_id, NEW.receiver_id),
                GREATEST(NEW.sender_id, NEW.receiver_id))
        ON DUPLICATE KEY UPDATE became_friends_at = CURRENT_TIMESTAMP;
    END IF;
END//

CREATE TRIGGER handle_friend_request_accept_update
AFTER UPDATE ON FriendRequests FOR EACH ROW
BEGIN
    IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
        INSERT INTO Friendships (user1_id, user2_id)
        VALUES (LEAST(NEW.sender_id, NEW.receiver_id),
                GREATEST(NEW.sender_id, NEW.receiver_id))
        ON DUPLICATE KEY UPDATE became_friends_at = CURRENT_TIMESTAMP;
    END IF;
END//

CREATE TRIGGER validate_private_message
BEFORE INSERT ON PrivateMessages FOR EACH ROW
BEGIN
    DECLARE are_friends INT;

    SELECT COUNT(*) INTO are_friends
    FROM Friendships
    WHERE user1_id = LEAST(NEW.sender_id, NEW.receiver_id)
      AND user2_id = GREATEST(NEW.sender_id, NEW.receiver_id);

    IF are_friends = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Users must be friends to send private messages';
    END IF;
END//

CREATE TRIGGER prevent_overlapping_host_events
BEFORE INSERT ON Events FOR EACH ROW
BEGIN
    DECLARE overlapping_events INT;

    SELECT COUNT(*) INTO overlapping_events
    FROM Events
    WHERE host_id = NEW.host_id
      AND event_datetime = NEW.event_datetime
      AND status <> 'cancelled';

    IF overlapping_events > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User cannot host overlapping events at the exact same time';
    END IF;
END//

CREATE TRIGGER prevent_overlapping_participant_events
BEFORE INSERT ON EventParticipation FOR EACH ROW
BEGIN
    DECLARE overlapping_events INT;

    SELECT COUNT(*) INTO overlapping_events
    FROM EventParticipation ep
    JOIN Events e ON ep.event_id = e.event_id
    WHERE ep.user_id = NEW.user_id
      AND e.event_datetime = (SELECT event_datetime FROM Events WHERE event_id = NEW.event_id)
      AND e.status <> 'cancelled';

    IF overlapping_events > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User cannot participate in overlapping events at the exact same time';
    END IF;
END//

CREATE TRIGGER update_watch_history_from_events
AFTER UPDATE ON Events FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
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
BEFORE INSERT ON Posts FOR EACH ROW
BEGIN
    DECLARE restricted_count INT;

    SELECT COUNT(*) INTO restricted_count
    FROM RestrictedWords
    WHERE is_active = TRUE
      AND NEW.content LIKE CONCAT('%', restricted_word, '%');

    IF restricted_count > 0 THEN
        SET NEW.status = 'under_review';
        SET NEW.flag_count = restricted_count;
    END IF;
END//

CREATE TRIGGER flag_comments_with_restricted_words
BEFORE INSERT ON Comments FOR EACH ROW
BEGIN
    DECLARE restricted_count INT;

    SELECT COUNT(*) INTO restricted_count
    FROM RestrictedWords
    WHERE is_active = TRUE
      AND NEW.content LIKE CONCAT('%', restricted_word, '%');

    IF restricted_count > 0 THEN
        SET NEW.status = 'under_review';
    END IF;
END//

CREATE TRIGGER log_admin_movie_actions
AFTER INSERT ON Movies FOR EACH ROW
BEGIN
    INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details)
    VALUES (NEW.created_by, 'INSERT', 'Movies', NEW.movie_id,
            CONCAT('Created movie: ', NEW.title));
END//

CREATE TRIGGER log_admin_moderation_actions
AFTER UPDATE ON Posts FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status AND NEW.status IN ('removed', 'active') THEN
        INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details)
        VALUES (NULL,
                CONCAT('MODERATE_', UPPER(NEW.status)),
                'Posts',
                NEW.post_id,
                CONCAT('Moderated post ID: ', NEW.post_id,
                       '. Status changed from ', OLD.status,
                       ' to ', NEW.status));
    END IF;
END//

DELIMITER ;

-- ----------------------------------------------------------------------
-- 4. Indexes
-- ----------------------------------------------------------------------

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

-- ----------------------------------------------------------------------
-- 5. Data Insertion (seed)
-- ----------------------------------------------------------------------

START TRANSACTION;

INSERT INTO Admins (username, password_hash, email, name, role) VALUES
('sysadmin',   '$2y$10$abcdefghijk', 'admin1@moviecommunity.com', 'System Administrator', 'super_admin'),
('moderator1', '$2y$10$lmnopqrstuv', 'mod1@moviecommunity.com',   'Alice Moderator',      'content_moderator'),
('moderator2', '$2y$10$wxyzabcdefg', 'mod2@moviecommunity.com',   'Bob Moderator',        'content_moderator'),
('contentadmin','$2y$10$hijklmnopqr','content@moviecommunity.com','Charlie Admin',        'content_moderator');

INSERT INTO Users (email, password_hash, name, created_at, last_login) VALUES
('john@example.com',  '$2y$10$hashjohn',  'John Doe',   NOW(), NOW()),
('jane@example.com',  '$2y$10$hashjane',  'Jane Smith', NOW(), NOW()),
('alex@example.com',  '$2y$10$hashalex',  'Alex Johnson', NOW(), NOW()),
('emily@example.com', '$2y$10$hashemily','Emily Davis', NOW(), NOW());

INSERT INTO Genres (genre_name, description) VALUES
('Action', 'High-energy films with stunts and chases'),
('Comedy', 'Light-hearted and funny movies'),
('Drama', 'Emotionally driven storytelling'),
('Sci-Fi', 'Futuristic and science-based fiction');

INSERT INTO Movies (title, synopsis, release_year, poster_image, duration_minutes, created_by) VALUES
('Sky Battle',   'A thrilling air combat film', 2022, 'poster_skybattle.jpg',   120, 1),
('Laugh Riot',   'A group of friends in a comedy adventure', 2021, 'poster_laughriot.jpg', 100, 2),
('Tears of Time','A touching drama about family and loss',   2020, 'poster_tearsoftime.jpg',130, 3),
('Galaxy Quest', 'Space explorers on an interstellar mission',2023,'poster_galaxyquest.jpg',140,4);

INSERT INTO MovieGenres (movie_id, genre_id) VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4);

INSERT INTO FriendRequests (sender_id, receiver_id, status) VALUES
(1, 2, 'accepted'),
(2, 3, 'accepted'),
(3, 4, 'pending'),
(4, 1, 'accepted');

INSERT INTO Watchlist (user_id, movie_id, status) VALUES
(1, 1, 'completed'),
(2, 2, 'watching'),
(3, 3, 'to-watch'),
(4, 4, 'to-watch');

INSERT INTO Reviews (user_id, movie_id, review_text, is_edited) VALUES
(1, 1, 'Incredible visuals and fast-paced action!', FALSE),
(2, 2, 'Hilarious from start to finish.',           FALSE),
(3, 3, 'Emotional and beautifully written.',        FALSE),
(4, 4, 'Futuristic and thrilling.',                 FALSE);

INSERT INTO Ratings (user_id, movie_id, rating_value) VALUES
(1, 1, 9),
(2, 2, 8),
(3, 3, 10),
(4, 4, 9);

INSERT INTO History (user_id, movie_id, action_type, status_before, status_after) VALUES
(1, 1, 'completed',       'watching', 'completed'),
(2, 2, 'status_changed',  'to-watch', 'watching'),
(3, 3, 'added_to_watchlist', NULL,    'to-watch'),
(4, 4, 'added_to_watchlist', NULL,    'to-watch');

INSERT INTO Posts (user_id, forum_id, content, status) VALUES
(1, 1, 'Loved the dogfight scenes!',          'active'),
(2, 2, 'Funniest movie I’ve seen this year.', 'active'),
(3, 3, 'This movie made me cry.',             'active'),
(4, 4, 'The space visuals are amazing!',      'active');

INSERT INTO Comments (post_id, user_id, content, status) VALUES
(1, 2, 'I agree, those scenes were great!', 'active'),
(2, 3, 'Totally! I laughed so hard.',      'active'),
(3, 4, 'Yes, very touching story.',        'active'),
(4, 1, 'Absolutely stunning!',             'active');

INSERT INTO Likes (user_id, post_id, comment_id) VALUES
(1, 2, NULL),
(2, 1, NULL),
(3, 3, NULL),
(4, 4, NULL),
(1, NULL, 4),
(2, NULL, 1);

INSERT INTO Notifications (user_id, sender_id, type, reference_id, message, is_seen) VALUES
(2, 1, 'friend_request', 1, 'John sent you a friend request',         FALSE),
(3, 2, 'friend_request', 2, 'Jane sent you a friend request',         FALSE),
(1, 4, 'comment',        4, 'Emily commented on your post',           FALSE),
(4, 3, 'like',           3, 'Alex liked your review',                 FALSE);

INSERT INTO Events (host_id, movie_id, event_title, description, event_datetime,
                    max_participants, current_participants) VALUES
(1, 1, 'Sky Battle Premiere', 'Watch and discuss Sky Battle', NOW() + INTERVAL 1 DAY, 10, 2),
(2, 2, 'Comedy Night',        'Laugh Riot screening',        NOW() + INTERVAL 2 DAY, 8,  3),
(3, 3, 'Drama Talk',          'Discuss emotional dramas',    NOW() + INTERVAL 3 DAY, 5,  4),
(4, 4, 'Sci-Fi Fan Meetup',   'Galaxy Quest fan gathering',  NOW() + INTERVAL 4 DAY, 6,  2);

INSERT INTO EventParticipation (user_id, event_id, status) VALUES
(1, 1, 'joined'),
(2, 2, 'joined'),
(3, 3, 'joined'),
(4, 4, 'joined');

INSERT INTO PrivateMessages (sender_id, receiver_id, content, is_read) VALUES
(1, 2, 'Hey Jane! Did you watch Sky Battle?',              FALSE),
(2, 3, 'Let’s plan for the next event.',                   FALSE),
(3, 4, 'Can you join the discussion tonight?',             FALSE),
(4, 1, 'Loved your post about Galaxy Quest!',              FALSE);

INSERT INTO RestrictedWords (restricted_word, added_by, is_active) VALUES
('spoiler',  1, TRUE),
('offensive',2, TRUE),
('hate',     3, TRUE),
('leak',     4, TRUE);

INSERT INTO Reports (generated_by, report_type, parameters, results_json) VALUES
(1, 'most_watched',      '{"period":"monthly"}',      '{"movie":"Sky Battle"}'),
(2, 'highest_rated',     '{"limit":5}',               '{"movie":"Tears of Time"}'),
(3, 'most_active_users', '{"month":"March"}',         '{"user":"John Doe"}'),
(4, 'popular_forums',    '{"category":"Sci-Fi"}',     '{"forum":"Galaxy Quest"}');

INSERT INTO UserActivity (user_id, total_posts, total_comments, total_reviews,
                          total_events_hosted, total_watched_movies, last_activity) VALUES
(1, 1, 1, 1, 1, 1, NOW()),
(2, 1, 1, 1, 1, 1, NOW()),
(3, 1, 1, 1, 1, 1, NOW()),
(4, 1, 1, 1, 1, 1, NOW());

INSERT INTO MovieStatistics (movie_id, total_watchlist_adds, total_completions,
                             total_forum_posts, last_updated) VALUES
(1, 4, 2, 2, NOW()),
(2, 3, 1, 3, NOW()),
(3, 2, 1, 1, NOW()),
(4, 4, 0, 0, NOW());

INSERT INTO UserFavoriteGenres (user_id, genre_id) VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4);

INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id,
                      action_details, ip_address) VALUES
(1, 'LOG_IN', 'Admins', 1, 'Successful login', '192.168.1.10');

COMMIT;
