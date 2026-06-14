const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'movstrem_secure_secret_key_999',
    resave: false,
    saveUninitialized: false, 
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

// ==========================================
// 1. CORE AUTHENTICATION
// ==========================================

app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin' || req.session.user.role === 'super_admin') res.redirect('/admin.html');
        else res.redirect('/dashboard.html');
    } else {
        res.redirect('/main.html');
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
        const [admins] = await db.query('SELECT * FROM Admins WHERE email = ?', [email]);

        let user = null;
        let role = 'user';

        if (users.length > 0) {
            user = users[0];
        } else if (admins.length > 0) {
            user = admins[0];
            role = 'admin';
        }

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        if (role === 'user') {
            await db.query('UPDATE Users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
        }

        req.session.user = { 
            id: role === 'admin' ? user.admin_id : user.user_id, 
            name: user.name, 
            role: role,
            email: user.email
        };
        
        res.json({ success: true, redirect: role === 'admin' ? '/admin.html' : '/dashboard.html' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/signup', async (req, res) => {
    const { username, email, password, role } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        if (role === 'admin') {
            await db.query('INSERT INTO Admins (username, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)', 
                [username, email, hash, username, 'content_moderator']);
        } else {
            await db.query('INSERT INTO Users (email, password_hash, name) VALUES (?, ?, ?)', 
                [email, hash, username]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'User already exists or database error' });
    }
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

function requireLogin(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'super_admin')) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}

// ==========================================
// 2. DATA API ENDPOINTS
// ==========================================

app.get('/api/user/dashboard', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    const systemId = req.session.user.id; 
    try {
        const [user] = await db.query('SELECT name, email FROM Users WHERE user_id = ?', [userId]);
        const [w] = await db.query(`SELECT m.title, w.status FROM Watchlist w JOIN Movies m ON w.movie_id = m.movie_id WHERE w.user_id = ? ORDER BY w.updated_at DESC LIMIT 5`, [userId]);
        const [r] = await db.query(`SELECT m.title, rev.review_text FROM Reviews rev JOIN Movies m ON rev.movie_id = m.movie_id WHERE rev.user_id = ? ORDER BY rev.created_at DESC LIMIT 3`, [userId]);
        const [f] = await db.query(`SELECT COUNT(*) as c FROM Friendships WHERE (user1_id = ? OR user2_id = ?)`, [userId, userId]);
        const [p] = await db.query('SELECT COUNT(*) as c FROM Posts WHERE user_id = ?', [userId]);
        const [c] = await db.query("SELECT COUNT(*) as c FROM Watchlist WHERE user_id = ? AND status = 'completed'", [userId]);

        res.json({ 
            user: user[0], 
            systemId, 
            watchlist: w, 
            reviews: r, 
            friendCount: f[0].c,
            postCount: p[0].c,
            completedCount: c[0].c
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/movies', requireLogin, async (req, res) => {
    try {
        const query = `
            SELECT m.*, 
            (SELECT GROUP_CONCAT(g.genre_name SEPARATOR ', ') FROM Genres g 
             JOIN MovieGenres mg ON g.genre_id = mg.genre_id 
             WHERE mg.movie_id = m.movie_id) as genre_name,
            (SELECT GROUP_CONCAT(g.genre_id) FROM Genres g 
             JOIN MovieGenres mg ON g.genre_id = mg.genre_id 
             WHERE mg.movie_id = m.movie_id) as genre_ids,
             COALESCE(ms.average_rating, 0) as average_rating,
             COALESCE(ms.total_reviews_stored, 0) as total_reviews
            FROM Movies m
            LEFT JOIN MovieStatistics ms ON m.movie_id = ms.movie_id
            ORDER BY m.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { 
        console.error("DB Error in /api/movies:", err);
        res.status(500).json({ error: err.message }); 
    }
});

app.get('/api/genres', requireLogin, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM Genres');
    res.json(rows);
});

app.get('/api/restricted-words', requireLogin, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM RestrictedWords WHERE is_active = TRUE');
    res.json(rows);
});

app.get('/api/posts', requireLogin, async (req, res) => {
    try {
        const query = `
            SELECT p.*, u.name as author_name, m.title as movie_title,
            (SELECT COUNT(*) FROM Likes WHERE post_id = p.post_id) as like_count,
            (SELECT COUNT(*) FROM Comments WHERE post_id = p.post_id) as comment_count
            FROM Posts p 
            JOIN Users u ON p.user_id = u.user_id 
            LEFT JOIN DiscussionForums df ON p.forum_id = df.forum_id
            LEFT JOIN Movies m ON df.movie_id = m.movie_id
            WHERE p.status = 'active'
            ORDER BY p.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/posts', requireLogin, async (req, res) => {
    const { movie_id, content } = req.body;
    const userId = req.session.user.id;

    if(!movie_id || !content) return res.status(400).json({error: "Missing details"});

    try {
        let [forum] = await db.query('SELECT forum_id FROM DiscussionForums WHERE movie_id = ?', [movie_id]);
        let forumId = forum.length > 0 ? forum[0].forum_id : null;
        
        if (!forumId) {
            const [res] = await db.query('INSERT INTO DiscussionForums (movie_id) VALUES (?)', [movie_id]);
            forumId = res.insertId;
        }

        await db.query(
            'INSERT INTO Posts (user_id, forum_id, content) VALUES (?, ?, ?)',
            [userId, forumId, content]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/posts/:id/like', requireLogin, async (req, res) => {
    const postId = req.params.id;
    const userId = req.session.user.id;
    const senderName = req.session.user.name;

    try {
        const [post] = await db.query('SELECT user_id FROM Posts WHERE post_id = ?', [postId]);
        if (post.length > 0 && post[0].user_id === userId) {
            return res.status(400).json({ error: "You cannot like your own post." });
        }

        await db.query('INSERT INTO Likes (user_id, post_id) VALUES (?, ?)', [userId, postId]);
        
        if (post.length > 0 && post[0].user_id !== userId) {
            await db.query(`INSERT INTO Notifications (user_id, sender_id, type, reference_id, message) 
                VALUES (?, ?, 'like', ?, ?)`, 
                [post[0].user_id, userId, postId, `${senderName} liked your post.`]);
        }

        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: "You have already liked this post." });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/posts/:id/comments', requireLogin, async (req, res) => {
    const postId = req.params.id;
    try {
        const [rows] = await db.query(`
            SELECT c.*, u.name as author_name 
            FROM Comments c 
            JOIN Users u ON c.user_id = u.user_id 
            WHERE c.post_id = ? 
            ORDER BY c.created_at ASC`, [postId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/posts/:id/comments', requireLogin, async (req, res) => {
    const postId = req.params.id;
    const userId = req.session.user.id;
    const senderName = req.session.user.name;
    const { content } = req.body;

    if(!content) return res.status(400).json({error: "Empty comment"});

    try {
        await db.query('INSERT INTO Comments (post_id, user_id, content) VALUES (?, ?, ?)', [postId, userId, content]);
        
        const [post] = await db.query('SELECT user_id FROM Posts WHERE post_id = ?', [postId]);
        if (post.length > 0 && post[0].user_id !== userId) {
             await db.query(`INSERT INTO Notifications (user_id, sender_id, type, reference_id, message) 
                VALUES (?, ?, 'comment', ?, ?)`, 
                [post[0].user_id, userId, postId, `${senderName} commented on your post.`]);
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/events', requireLogin, async (req, res) => {
    try {
        const query = `
            SELECT e.event_id, e.event_title, e.event_datetime, e.status, e.description, e.max_participants, e.current_participants,
                   m.title as movie_title, m.movie_id, m.duration_minutes, m.poster_image,
                   COALESCE(u.name, 'Admin') as host_name
            FROM Events e
            JOIN Movies m ON e.movie_id = m.movie_id
            LEFT JOIN Users u ON e.host_id = u.user_id
            WHERE e.status != 'cancelled'
            ORDER BY e.event_datetime ASC
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch events' }); }
});

app.post('/api/user/events', requireLogin, async (req, res) => {
    let { title, movie_id, event_datetime, description, capacity } = req.body;
    const userId = req.session.user.id;

    try {
        if (event_datetime) {
            event_datetime = event_datetime.replace('T', ' ');
            if (event_datetime.length === 16) event_datetime += ':00';
        }

        const [movie] = await db.query('SELECT duration_minutes FROM Movies WHERE movie_id = ?', [movie_id]);
        if (movie.length === 0) return res.status(400).json({ error: "Invalid movie" });
        
        const duration = movie[0].duration_minutes || 120; 
        const newStart = new Date(event_datetime);
        const newEnd = new Date(newStart.getTime() + duration * 60000); 

        const [existing] = await db.query(`
            SELECT e.event_datetime, m.duration_minutes 
            FROM Events e 
            JOIN Movies m ON e.movie_id = m.movie_id 
            WHERE e.host_id = ? AND e.status != 'cancelled'
        `, [userId]);

        for (const ev of existing) {
            const evStart = new Date(ev.event_datetime);
            const evDuration = ev.duration_minutes || 120;
            const evEnd = new Date(evStart.getTime() + evDuration * 60000);
            if (newStart < evEnd && newEnd > evStart) {
                return res.status(400).json({ error: "Scheduling Conflict: You already have an event scheduled during this time window." });
            }
        }

        await db.query(
            `INSERT INTO Events (host_id, movie_id, event_title, event_datetime, description, max_participants, status) 
             VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
            [userId, movie_id, title, event_datetime, description, capacity || 20]
        );

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/events/:id/join', requireLogin, async (req, res) => {
    const eventId = req.params.id;
    const userId = req.session.user.id;

    try {
        const [event] = await db.query(`
            SELECT e.*, m.duration_minutes 
            FROM Events e 
            JOIN Movies m ON e.movie_id = m.movie_id 
            WHERE e.event_id = ?`, [eventId]);

        if (event.length === 0) return res.status(404).json({ error: "Event not found" });
        const ev = event[0];

        if (ev.current_participants >= ev.max_participants) {
            return res.status(400).json({ error: "Event is full." });
        }

        const newStart = new Date(ev.event_datetime);
        const duration = ev.duration_minutes || 120;
        const newEnd = new Date(newStart.getTime() + duration * 60000);

        const [myEvents] = await db.query(`
            SELECT e.event_datetime, m.duration_minutes 
            FROM Events e
            JOIN Movies m ON e.movie_id = m.movie_id
            LEFT JOIN EventParticipation ep ON e.event_id = ep.event_id
            WHERE (ep.user_id = ? OR e.host_id = ?) 
            AND e.status != 'cancelled'
        `, [userId, userId]);

        for (const existing of myEvents) {
            const exStart = new Date(existing.event_datetime);
            const exDuration = existing.duration_minutes || 120;
            const exEnd = new Date(exStart.getTime() + exDuration * 60000);

            if (newStart < exEnd && newEnd > exStart) {
                return res.status(400).json({ error: "Scheduling Conflict: You are already joined/hosting another event at this time." });
            }
        }

        await db.query('INSERT INTO EventParticipation (user_id, event_id) VALUES (?, ?)', [userId, eventId]);
        await db.query('UPDATE Events SET current_participants = current_participants + 1 WHERE event_id = ?', [eventId]);

        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "You have already joined this event." });
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/events/conclude', async (req, res) => {
    try {
        const [endedEvents] = await db.query(`
            SELECT event_id, movie_id 
            FROM Events 
            WHERE status = 'scheduled' AND event_datetime < NOW()
        `);

        for (const ev of endedEvents) {
            await db.query("UPDATE Events SET status = 'completed' WHERE event_id = ?", [ev.event_id]);

            const [participants] = await db.query("SELECT user_id FROM EventParticipation WHERE event_id = ?", [ev.event_id]);

            for (const p of participants) {
                await db.query(`
                    INSERT INTO Watchlist (user_id, movie_id, status) 
                    VALUES (?, ?, 'completed') 
                    ON DUPLICATE KEY UPDATE status = 'completed', updated_at = NOW()
                `, [p.user_id, ev.movie_id]);

                await db.query(`
                    INSERT INTO History (user_id, movie_id, action_type, status_after) 
                    VALUES (?, ?, 'completed', 'completed')
                `, [p.user_id, ev.movie_id]);
            }
        }

        res.json({ success: true, count: endedEvents.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/messages/:friendId', requireLogin, async (req, res) => {
    const myId = req.session.user.id;
    const friendId = req.params.friendId;

    try {
        await db.query(
            `UPDATE PrivateMessages SET is_read = TRUE, read_at = NOW()
             WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE`,
            [friendId, myId]
        );

        const query = `
            SELECT m.*, 
                   CASE WHEN sender_id = ? THEN 'sent' ELSE 'received' END as type
            FROM PrivateMessages m
            WHERE (sender_id = ? AND receiver_id = ?) 
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY sent_at ASC
        `;
        const [rows] = await db.query(query, [myId, myId, friendId, friendId, myId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/messages', requireLogin, async (req, res) => {
    const { receiver_id, content } = req.body;
    const sender_id = req.session.user.id;
    const senderName = req.session.user.name;

    if (!content) return res.status(400).json({ error: "Empty message" });

    try {
        await db.query(
            `INSERT INTO PrivateMessages (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
            [sender_id, receiver_id, content]
        );

        await db.query(`INSERT INTO Notifications (user_id, sender_id, type, message) 
            VALUES (?, ?, 'private_message', ?)`, 
            [receiver_id, sender_id, `${senderName} sent you a private message.`]);

        res.json({ success: true });
    } catch (err) {
        if (err.sqlState === '45000') {
            res.status(403).json({ error: err.message }); 
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/messages/read/:friendId', requireLogin, async (req, res) => {
    const myId = req.session.user.id;
    const friendId = req.params.friendId;

    try {
        await db.query(
            `UPDATE PrivateMessages SET is_read = TRUE, read_at = NOW()
             WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE`,
            [friendId, myId]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/watchlist', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const query = `
            SELECT w.watchlist_id, w.status, w.updated_at, m.title, m.movie_id 
            FROM Watchlist w
            JOIN Movies m ON w.movie_id = m.movie_id
            WHERE w.user_id = ?
            ORDER BY w.updated_at DESC
        `;
        const [rows] = await db.query(query, [userId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/watchlist', requireLogin, async (req, res) => {
    const { movie_id, status } = req.body;
    const userId = req.session.user.id;
    const validStatuses = ['to-watch', 'watching', 'completed'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    try {
        const [existing] = await db.query(
            'SELECT * FROM Watchlist WHERE user_id = ? AND movie_id = ?',
            [userId, movie_id]
        );

        if (existing.length > 0) {
            const oldStatus = existing[0].status;
            if (oldStatus !== status) {
                await db.query(
                    'UPDATE Watchlist SET status = ?, updated_at = NOW() WHERE watchlist_id = ?',
                    [status, existing[0].watchlist_id]
                );
                const action = status === 'completed' ? 'completed' : 'status_changed';
                await db.query(
                    `INSERT INTO History (user_id, movie_id, action_type, status_before, status_after) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [userId, movie_id, action, oldStatus, status]
                );
            }
        } else {
            await db.query(
                `INSERT INTO Watchlist (user_id, movie_id, status) VALUES (?, ?, ?)`,
                [userId, movie_id, status]
            );
            await db.query(
                `INSERT INTO History (user_id, movie_id, action_type, status_after) 
                 VALUES (?, ?, 'added_to_watchlist', ?)`,
                [userId, movie_id, status]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user/history', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const query = `
            SELECT h.action_type, h.action_date, h.status_after, m.title 
            FROM History h
            JOIN Movies m ON h.movie_id = m.movie_id
            WHERE h.user_id = ?
            ORDER BY h.action_date DESC
            LIMIT 20
        `;
        const [rows] = await db.query(query, [userId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/movies/:id/reviews', requireLogin, async (req, res) => {
    const movieId = req.params.id;
    try {
        const query = `
            SELECT r.review_id, r.review_text, r.created_at, r.user_id,
                   u.name as user_name,
                   COALESCE(rat.rating_value, 0) as rating
            FROM Reviews r
            JOIN Users u ON r.user_id = u.user_id
            LEFT JOIN Ratings rat ON r.user_id = rat.user_id AND r.movie_id = rat.movie_id
            WHERE r.movie_id = ?
            ORDER BY r.created_at DESC
        `;
        const [rows] = await db.query(query, [movieId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/movies/:id/reviews', requireLogin, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.session.user.id;
    const { rating, review_text } = req.body;

    if (!rating || !review_text) return res.status(400).json({ error: "Missing rating or text" });

    try {
        const [existing] = await db.query('SELECT * FROM Reviews WHERE user_id = ? AND movie_id = ?', [userId, movieId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "You have already reviewed this movie." });
        }

        await db.query('CALL sp_AddReview(?, ?, ?, ?)', [userId, movieId, rating, review_text]);
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/reviews/:id', requireLogin, async (req, res) => {
    const reviewId = req.params.id;
    const userId = req.session.user.id;

    try {
        const [review] = await db.query('SELECT * FROM Reviews WHERE review_id = ? AND user_id = ?', [reviewId, userId]);
        if (review.length === 0) return res.status(403).json({ error: "Not authorized" });

        await db.query('DELETE FROM Reviews WHERE review_id = ?', [reviewId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/movies/:id/forum', requireLogin, async (req, res) => {
    const movieId = req.params.id;
    try {
        const [forum] = await db.query('SELECT forum_id FROM DiscussionForums WHERE movie_id = ?', [movieId]);
        if (forum.length === 0) {
            await db.query('INSERT INTO DiscussionForums (movie_id) VALUES (?)', [movieId]);
            return res.json([]); 
        }
        const forumId = forum[0].forum_id;
        const query = `
            SELECT p.post_id, p.content, p.created_at, u.name as user_name
            FROM Posts p
            JOIN Users u ON p.user_id = u.user_id
            WHERE p.forum_id = ? AND p.status = 'active'
            ORDER BY p.created_at DESC
        `;
        const [posts] = await db.query(query, [forumId]);
        res.json(posts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/movies/:id/forum', requireLogin, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.session.user.id;
    const { content } = req.body;

    if (!content) return res.status(400).json({ error: "Post content cannot be empty" });

    try {
        let [forum] = await db.query('SELECT forum_id FROM DiscussionForums WHERE movie_id = ?', [movieId]);
        let forumId;
        if (forum.length === 0) {
            const [result] = await db.query('INSERT INTO DiscussionForums (movie_id) VALUES (?)', [movieId]);
            forumId = result.insertId;
        } else {
            forumId = forum[0].forum_id;
        }
        await db.query(
            'INSERT INTO Posts (user_id, forum_id, content) VALUES (?, ?, ?)',
            [userId, forumId, content]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/search', requireLogin, async (req, res) => {
    const { q } = req.query;
    const myId = req.session.user.id;
    if (!q) return res.json([]);

    try {
        const query = `
            SELECT user_id, name, email 
            FROM Users 
            WHERE (name LIKE ? OR email LIKE ?)
            AND user_id != ?
            AND user_id NOT IN (
                SELECT sender_id FROM FriendRequests WHERE receiver_id = ?
                UNION
                SELECT receiver_id FROM FriendRequests WHERE sender_id = ?
                UNION
                SELECT user2_id FROM Friendships WHERE user1_id = ?
                UNION
                SELECT user1_id FROM Friendships WHERE user2_id = ?
            )
            LIMIT 5
        `;
        const [rows] = await db.query(query, [`%${q}%`, `%${q}%`, myId, myId, myId, myId, myId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/friends/request', requireLogin, async (req, res) => {
    const { receiver_id } = req.body;
    const sender_id = req.session.user.id;
    const senderName = req.session.user.name;

    if (parseInt(receiver_id) === parseInt(sender_id)) {
        return res.status(400).json({ error: "You cannot send a friend request to yourself." });
    }

    try {
        await db.query(
            `INSERT INTO FriendRequests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')`,
            [sender_id, receiver_id]
        );
        
        await db.query(`INSERT INTO Notifications (user_id, sender_id, type, message) 
            VALUES (?, ?, 'friend_request', ?)`, 
            [receiver_id, sender_id, `${senderName} sent you a friend request.`]);

        res.json({ success: true });
    } catch (err) { 
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Friend request already sent or users are already friends.' });
        } else {
            res.status(500).json({ error: 'Database error' }); 
        }
    }
});

app.get('/api/friends/requests', requireLogin, async (req, res) => {
    const myId = req.session.user.id;
    try {
        const [rows] = await db.query(`
            SELECT fr.request_id, u.name, u.email 
            FROM FriendRequests fr
            JOIN Users u ON fr.sender_id = u.user_id
            WHERE fr.receiver_id = ? AND fr.status = 'pending'
        `, [myId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/friends/respond', requireLogin, async (req, res) => {
    const { request_id, action } = req.body; 
    const myId = req.session.user.id;
    
    if(!['accepted', 'declined'].includes(action)) return res.status(400).json({error:'Invalid action'});

    try {
        await db.query(
            `UPDATE FriendRequests SET status = ?, responded_at = NOW() 
             WHERE request_id = ? AND receiver_id = ?`,
            [action, request_id, myId]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/friends', requireLogin, async (req, res) => {
    const myId = req.session.user.id;
    try {
        const query = `
            SELECT u.user_id, u.name, u.email 
            FROM Friendships f
            JOIN Users u ON (f.user1_id = u.user_id OR f.user2_id = u.user_id)
            WHERE (f.user1_id = ? OR f.user2_id = ?) 
            AND u.user_id != ?
        `;
        const [rows] = await db.query(query, [myId, myId, myId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id/profile', requireLogin, async (req, res) => {
    const friendId = req.params.id;
    const myId = req.session.user.id;

    try {
        const [friendship] = await db.query(`
            SELECT * FROM Friendships 
            WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
        `, [myId, friendId, friendId, myId]);

        if (friendship.length === 0) {
            return res.status(403).json({ error: "You can only view profiles of your friends." });
        }

        const [user] = await db.query('SELECT name, email, created_at FROM Users WHERE user_id = ?', [friendId]);
        
        const [posts] = await db.query(`
            SELECT p.*, m.title as movie_title 
            FROM Posts p 
            LEFT JOIN DiscussionForums df ON p.forum_id = df.forum_id
            LEFT JOIN Movies m ON df.movie_id = m.movie_id
            WHERE p.user_id = ? 
            ORDER BY p.created_at DESC
        `, [friendId]);

        res.json({ user: user[0], posts: posts });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notifications', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    try {
        await db.query("DELETE FROM Notifications WHERE user_id = ? AND created_at < NOW() - INTERVAL 1 DAY", [userId]);
        const [rows] = await db.query(
            'SELECT * FROM Notifications WHERE user_id = ? AND is_seen = FALSE ORDER BY created_at DESC',
            [userId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notifications/count', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const [rows] = await db.query(
            'SELECT COUNT(*) as count FROM Notifications WHERE user_id = ? AND is_seen = FALSE',
            [userId]
        );
        res.json({ count: rows[0].count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/read', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    try {
        await db.query('UPDATE Notifications SET is_seen = TRUE WHERE user_id = ?', [userId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/user/recommendations', requireLogin, async (req, res) => {
    try {
        const query = `
            SELECT m.title, m.movie_id, m.poster_image, m.release_year, 
                   COALESCE(ms.average_rating, 0) as rating,
                   (SELECT GROUP_CONCAT(g.genre_name SEPARATOR ', ') FROM Genres g 
                    JOIN MovieGenres mg ON g.genre_id = mg.genre_id 
                    WHERE mg.movie_id = m.movie_id) as genre_name
            FROM Movies m
            LEFT JOIN MovieStatistics ms ON m.movie_id = ms.movie_id
            ORDER BY rating DESC
            LIMIT 10
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/user/trending', requireLogin, async (req, res) => {
    try {
        const query = `
            SELECT m.movie_id, m.title, m.poster_image, m.release_year, 
                   COUNT(w.user_id) as views
            FROM Movies m
            JOIN Watchlist w ON m.movie_id = w.movie_id
            WHERE w.status = 'completed'
            GROUP BY m.movie_id, m.title, m.poster_image, m.release_year
            ORDER BY views DESC
            LIMIT 10
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 3. ADMIN SPECIFIC API ENDPOINTS
// ==========================================

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const [u] = await db.query('SELECT COUNT(*) as c FROM Users');
        const [m] = await db.query('SELECT COUNT(*) as c FROM Movies');
        const [p] = await db.query('SELECT COUNT(*) as c FROM Posts');
        
        const [completed] = await db.query("SELECT COUNT(*) as c FROM Watchlist WHERE status = 'completed'");
        const [trending] = await db.query("SELECT title, completion_count FROM View_Top10_Watched LIMIT 5");

        res.json({ 
            users: u[0].c, 
            movies: m[0].c, 
            posts: p[0].c,
            completed_movies: completed[0].c,
            trending: trending
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    const [rows] = await db.query('SELECT user_id, name, email FROM Users');
    res.json(rows);
});

app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT user_id, name, email, created_at, last_login FROM Users WHERE user_id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const adminId = req.session.user.id;
    try {
        await db.query('DELETE FROM Users WHERE user_id = ?', [req.params.id]);
        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details) VALUES (?, ?, ?, ?, ?)', 
            [adminId, 'DELETE', 'Users', req.params.id, 'Deleted user account']);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: MANAGE POSTS & MODERATION
app.get('/api/admin/posts', requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.post_id, p.content, p.created_at, p.status, u.name as author 
            FROM Posts p 
            JOIN Users u ON p.user_id = u.user_id 
            ORDER BY p.created_at DESC`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/posts/:id', requireAdmin, async (req, res) => {
    const postId = req.params.id;
    const adminId = req.session.user.id;
    try {
        const [post] = await db.query('SELECT content FROM Posts WHERE post_id = ?', [postId]);
        const contentSnippet = post.length > 0 ? post[0].content.substring(0, 50) : 'Unknown';

        await db.query('DELETE FROM Posts WHERE post_id = ?', [postId]);
        
        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details) VALUES (?, ?, ?, ?, ?)', 
            [adminId, 'DELETE', 'Posts', postId, `Deleted post: ${contentSnippet}...`]);
            
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/posts/:id/comments', requireAdmin, async (req, res) => {
    const postId = req.params.id;
    try {
        const [rows] = await db.query(`
            SELECT c.comment_id, c.content, c.created_at, u.name as author 
            FROM Comments c 
            JOIN Users u ON c.user_id = u.user_id 
            WHERE c.post_id = ? 
            ORDER BY c.created_at ASC`, [postId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/comments/:id', requireAdmin, async (req, res) => {
    const commentId = req.params.id;
    const adminId = req.session.user.id;
    try {
        const [comment] = await db.query('SELECT content FROM Comments WHERE comment_id = ?', [commentId]);
        const contentSnippet = comment.length > 0 ? comment[0].content.substring(0, 50) : 'Unknown';

        await db.query('DELETE FROM Comments WHERE comment_id = ?', [commentId]);
        
        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details) VALUES (?, ?, ?, ?, ?)', 
            [adminId, 'DELETE', 'Comments', commentId, `Deleted comment: ${contentSnippet}...`]);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/events', requireAdmin, async (req, res) => {
    try {
        const query = `
            SELECT e.event_id, e.event_title, e.event_datetime, e.status, e.description,
                   m.title as movie_title, m.movie_id,
                   COALESCE(u.name, 'Admin') as host_name
            FROM Events e
            JOIN Movies m ON e.movie_id = m.movie_id
            LEFT JOIN Users u ON e.host_id = u.user_id
            ORDER BY e.event_datetime DESC
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch events' }); }
});

app.post('/api/admin/events', requireAdmin, async (req, res) => {
    let { title, movie_id, event_datetime, description } = req.body;
    const adminName = req.session.user.name || 'Admin';
    const adminEmail = req.session.user.email;
    const adminId = req.session.user.id;

    try {
        if (event_datetime) {
            event_datetime = event_datetime.replace('T', ' ');
            if (event_datetime.length === 16) event_datetime += ':00';
        }

        let [users] = await db.query('SELECT user_id FROM Users WHERE email = ?', [adminEmail]);
        let hostId;

        if (users.length > 0) {
            hostId = users[0].user_id;
        } else {
            const [result] = await db.query(
                'INSERT INTO Users (email, password_hash, name) VALUES (?, ?, ?)', 
                [adminEmail, '$2y$10$dummyhashforadminhosting', adminName]
            );
            hostId = result.insertId;
        }

        await db.query(
            `INSERT INTO Events (host_id, movie_id, event_title, event_datetime, description, status) 
             VALUES (?, ?, ?, ?, ?, 'scheduled')`,
            [hostId, movie_id, title, event_datetime, description]
        );

        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, action_details) VALUES (?, ?, ?, ?)', 
            [adminId, 'INSERT', 'Events', `Created event: ${title}`]);

        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.put('/api/admin/events', requireAdmin, async (req, res) => {
    const { event_id, title, movie_id, event_datetime, description } = req.body;
    const adminId = req.session.user.id;
    try {
        await db.query(
            `UPDATE Events 
             SET event_title=?, movie_id=?, event_datetime=?, description=?
             WHERE event_id=?`,
            [title, movie_id, event_datetime, description, event_id]
        );

        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details) VALUES (?, ?, ?, ?, ?)', 
            [adminId, 'UPDATE', 'Events', event_id, `Updated event: ${title}`]);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/events/cancel', requireAdmin, async (req, res) => {
    const { event_id } = req.body;
    const adminId = req.session.user.id;
    try {
        await db.query("UPDATE Events SET status = 'cancelled' WHERE event_id = ?", [event_id]);

        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details) VALUES (?, ?, ?, ?, ?)', 
            [adminId, 'UPDATE', 'Events', event_id, 'Cancelled event']);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/movies', requireAdmin, async (req, res) => {
    const { title, release_year, duration_minutes, synopsis, poster_image, genres } = req.body;
    const adminId = req.session.user.id;

    try {
        const [result] = await db.query(
            `INSERT INTO Movies (title, release_year, duration_minutes, synopsis, poster_image, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
            [title, release_year, duration_minutes, synopsis, poster_image, adminId]
        );
        const newMovieId = result.insertId;

        if (genres && Array.isArray(genres)) {
            for (const genreId of genres) {
                await db.query(`INSERT INTO MovieGenres (movie_id, genre_id) VALUES (?, ?)`, [newMovieId, genreId]);
            }
        }

        // AUDIT TRAIL (Handled by trigger, but explicit call for completeness if trigger fails/disabled)
        // Actually, we already have a trigger `log_admin_movie_actions` in SQL.

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/movies', requireAdmin, async (req, res) => {
    const { movie_id, title, release_year, duration_minutes, synopsis, poster_image, genres } = req.body;
    const adminId = req.session.user.id;
    
    try {
        await db.query(
            `UPDATE Movies SET title=?, release_year=?, duration_minutes=?, synopsis=?, poster_image=? WHERE movie_id=?`,
            [title, release_year, duration_minutes, synopsis, poster_image, movie_id]
        );

        await db.query(`DELETE FROM MovieGenres WHERE movie_id=?`, [movie_id]);
        
        if (genres && Array.isArray(genres)) {
            for (const genreId of genres) {
                await db.query(`INSERT INTO MovieGenres (movie_id, genre_id) VALUES (?, ?)`, [movie_id, genreId]);
            }
        }

        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details) VALUES (?, ?, ?, ?, ?)', 
            [adminId, 'UPDATE', 'Movies', movie_id, `Updated movie: ${title}`]);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/movies/:id', requireAdmin, async (req, res) => {
    const adminId = req.session.user.id;
    try {
        await db.query(`DELETE FROM Movies WHERE movie_id = ?`, [req.params.id]);
        
        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details) VALUES (?, ?, ?, ?, ?)', 
            [adminId, 'DELETE', 'Movies', req.params.id, 'Deleted movie']);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// MODERATION & RESTRICTED WORDS (NEW)
app.get('/api/restricted-words', requireLogin, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM RestrictedWords WHERE is_active = TRUE');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/restricted-words', requireAdmin, async (req, res) => {
    const { word } = req.body;
    const adminId = req.session.user.id;
    try {
        await db.query('INSERT INTO RestrictedWords (restricted_word, added_by) VALUES (?, ?)', [word, adminId]);
        
        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, action_details) VALUES (?, ?, ?, ?)', 
            [adminId, 'INSERT', 'RestrictedWords', `Added restricted word: ${word}`]);
            
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/restricted-words/:id', requireAdmin, async (req, res) => {
    const wordId = req.params.id;
    const adminId = req.session.user.id;
    try {
        await db.query('DELETE FROM RestrictedWords WHERE word_id = ?', [wordId]);
        
        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details) VALUES (?, ?, ?, ?, ?)', 
            [adminId, 'DELETE', 'RestrictedWords', wordId, 'Removed restricted word']);
            
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/moderation', requireAdmin, async (req, res) => {
    try {
        const [posts] = await db.query(`
            SELECT 'post' as type, p.post_id as id, p.content, u.name as author, p.created_at 
            FROM Posts p JOIN Users u ON p.user_id = u.user_id 
            WHERE p.status IN ('flagged', 'under_review')
        `);
        const [comments] = await db.query(`
            SELECT 'comment' as type, c.comment_id as id, c.content, u.name as author, c.created_at 
            FROM Comments c JOIN Users u ON c.user_id = u.user_id 
            WHERE c.status IN ('flagged', 'under_review')
        `);
        res.json([...posts, ...comments]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/moderation', requireAdmin, async (req, res) => {
    const { type, id, action } = req.body; 
    const adminId = req.session.user.id;
    const newStatus = action === 'approve' ? 'active' : 'removed';
    const table = type === 'post' ? 'Posts' : 'Comments';
    const idCol = type === 'post' ? 'post_id' : 'comment_id';

    try {
        await db.query(`UPDATE ${table} SET status = ? WHERE ${idCol} = ?`, [newStatus, id]);
        
        // AUDIT TRAIL
        await db.query('INSERT INTO AuditLog (admin_id, action_type, target_table, target_record_id, action_details) VALUES (?, ?, ?, ?, ?)', 
            [adminId, `MODERATE_${action.toUpperCase()}`, table, id, `${action}d flagged content.`]);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// NEW: Audit Logs Endpoint
app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
    try {
        const query = `
            SELECT a.*, COALESCE(u.username, 'System') as admin_name
            FROM AuditLog a
            LEFT JOIN Admins u ON a.admin_id = u.admin_id
            ORDER BY a.performed_at DESC
            LIMIT 50
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// REPORT GENERATION
app.get('/api/reports/top-movies', requireAdmin, async (req, res) => {
    try {
        const query = `
            SELECT m.title, m.release_year, COUNT(w.user_id) as completion_count
            FROM Movies m
            JOIN Watchlist w ON m.movie_id = w.movie_id
            WHERE w.status = 'completed'
            GROUP BY m.movie_id
            ORDER BY completion_count DESC
            LIMIT 10
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/highest-rated', requireAdmin, async (req, res) => {
    try {
        const query = `
            SELECT m.title, m.release_year, ms.average_rating, ms.total_reviews_stored
            FROM Movies m
            JOIN MovieStatistics ms ON m.movie_id = ms.movie_id
            ORDER BY ms.average_rating DESC
            LIMIT 10
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/active-users', requireAdmin, async (req, res) => {
    try {
        const query = `
            SELECT u.name, u.email,
            (SELECT COUNT(*) FROM Posts p WHERE p.user_id = u.user_id) +
            (SELECT COUNT(*) FROM Comments c WHERE c.user_id = u.user_id) +
            (SELECT COUNT(*) FROM Reviews r WHERE r.user_id = u.user_id) as activity_score
            FROM Users u
            ORDER BY activity_score DESC
            LIMIT 10
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/popular-forums', requireAdmin, async (req, res) => {
    try {
        const query = `
            SELECT m.title as movie_title, COUNT(p.post_id) as total_posts
            FROM DiscussionForums df
            JOIN Movies m ON df.movie_id = m.movie_id
            JOIN Posts p ON df.forum_id = p.forum_id
            GROUP BY df.forum_id
            ORDER BY total_posts DESC
            LIMIT 10
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});