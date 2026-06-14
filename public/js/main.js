// public/js/main.js

// ==========================================
// 1. GLOBAL UI & SECURITY
// ==========================================

async function checkAuthAndUI() {
    const pathParts = window.location.pathname.split("/");
    const page = pathParts[pathParts.length - 1];

    const publicPages = ['login.html', 'signup.html', 'main.html', ''];
    if (publicPages.includes(page)) return;

    // Admin Pages List
    const adminPages = [
        'admin.html', 'users1.html', 'movies1.html', 'events1.html', 
        'post1.html', 'genres1.html', 'restrictedwords1.html', 'auditlogs1.html'
    ];
    // User Pages List
    const userPages = [
        'dashboard.html', 'profile.html', 'friends.html', 'movies.html', 
        'events.html', 'post.html', 'other.html'
    ];

    try {
        const res = await fetch('/api/check-auth');
        const data = await res.json();

        // 1. Not Authenticated
        if (!data.authenticated) {
            window.location.href = 'login.html';
            return;
        }

        // 2. Role Checks
        if (adminPages.includes(page) && data.user.role !== 'admin') {
            alert("Access Denied: You need Admin privileges.");
            window.location.href = 'login.html'; 
            return;
        }

        if (userPages.includes(page) && data.user.role !== 'user') {
            alert("Access Denied: This is a User-only view. Please login as a Standard User.");
            window.location.href = 'login.html';
            return;
        }

        // 3. Navbar Update
        const profileActions = document.querySelector('.profile-actions');
        if (profileActions) {
            profileActions.innerHTML = `
                <a href="other.html" style="position:relative; text-decoration:none; margin-right:15px;">
                    🔔 
                    <span id="notifBadge" style="display:none; position:absolute; top:-5px; right:-5px; background:red; color:white; font-size:0.7rem; padding:2px 5px; border-radius:50%;">0</span>
                </a>
                <span style="margin-right:15px; font-weight:500; font-size:0.9rem;">${data.user.name}</span>
                <button onclick="handleLogout()" style="background:transparent; border:1px solid #fff; color:#fff; padding:6px 16px; border-radius:20px; cursor:pointer; font-weight:600; font-size:0.85rem;">Logout</button>
            `;
            updateNotificationBadge();
        }
        
        // 4. Page Specific Loaders
        if (page === 'users1.html') loadManageUsers();
        if (page === 'genres1.html') loadGenres();
        if (page === 'restrictedwords1.html') loadRestrictedWordsPage();
        if (page === 'admin.html') { loadAdminStats(); loadModerationQueue(); }
        if (page === 'movies1.html') loadAdminMovies(); 
        if (page === 'movies.html') loadUserMovies();
        if (page === 'events.html') loadUserEvents(); 
        if (page === 'friends.html') loadFriendsPage();
        if (page === 'auditlogs1.html') loadAuditLogs();
        if (page === 'other.html') {
            loadUserWatchlist();
            loadUserHistory();
            loadNotifications();
        }
        if (page === 'dashboard.html') {
            loadUserDashboard();
            loadUserRecommendations();
            loadTrendingMovies();
        }
        if (page === 'post.html') {
            populateMovieDropdown(); 
            loadCommunityPosts();
        }
        if (page === 'post1.html') loadManagePosts();
        
    } catch (e) {
        console.error("Auth Check Failed:", e);
        window.location.href = 'login.html';
    }
}

async function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if(!badge) return;
    try {
        const res = await fetch('/api/notifications/count');
        const data = await res.json();
        if (data.count > 0) {
            badge.innerText = data.count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch(e) {}
}

// ==========================================
//  AUDIT LOGS
// ==========================================

async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogBody');
    if(!tbody) return;

    try {
        const res = await fetch('/api/admin/audit-logs');
        const logs = await res.json();

        if(logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No logs found.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => {
            // Determine badge style based on action type
            let badgeClass = '';
            if (log.action_type.includes('INSERT')) badgeClass = 'badge-INSERT';
            else if (log.action_type.includes('UPDATE')) badgeClass = 'badge-UPDATE';
            else if (log.action_type.includes('DELETE')) badgeClass = 'badge-DELETE';
            else badgeClass = 'badge-MODERATE';

            return `
            <tr>
                <td>${log.admin_name}</td>
                <td><span class="action-badge ${badgeClass}">${log.action_type}</span></td>
                <td>${log.target_table} (ID: ${log.target_record_id || '-'})</td>
                <td>${log.action_details}</td>
                <td>${new Date(log.performed_at).toLocaleString()}</td>
            </tr>
            `;
        }).join('');
    } catch(err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading logs.</td></tr>';
    }
}

// ==========================================
// 2. ADMIN: MANAGE USERS
// ==========================================

async function loadManageUsers() {
    const tbody = document.querySelector('tbody');
    if(!tbody) return;

    try {
        const res = await fetch('/api/admin/users');
        const users = await res.json();
        if (!Array.isArray(users)) return;

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>
                    <button class="view" onclick="viewUser(${u.user_id})">View</button>
                    <button class="delete" onclick="deleteUser(${u.user_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { console.error("Error loading users", err); }
}

async function viewUser(id) {
    try {
        const res = await fetch(`/api/admin/users/${id}`);
        const user = await res.json();
        
        if(user.error) { alert(user.error); return; }

        const nameEl = document.getElementById('modalUserName');
        const emailEl = document.getElementById('modalUserEmail');
        const joinedEl = document.getElementById('modalUserJoined');
        const loginEl = document.getElementById('modalUserLogin');

        if(nameEl) nameEl.innerText = user.name;
        if(emailEl) emailEl.innerText = user.email;
        if(joinedEl) joinedEl.innerText = new Date(user.created_at).toLocaleDateString();
        if(loginEl) loginEl.innerText = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
        
        const modal = document.getElementById('userModal');
        if(modal) modal.style.display = 'flex';
    } catch(err) { alert("Failed to load user details"); }
}

async function deleteUser(id) {
    if(!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    try {
        const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if(result.success) {
            loadManageUsers(); 
        } else {
            alert("Error deleting user");
        }
    } catch(err) { alert("Server error"); }
}

// ==========================================
// 3. ADMIN: MANAGE EVENTS
// ==========================================

let allEventsCache = []; 

async function loadAdminEvents() {
    const tbody = document.getElementById('adminEventsTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/admin/events');
        allEventsCache = await res.json();
        renderEventsTable(allEventsCache);
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading events.</td></tr>';
    }
}

function renderEventsTable(events) {
    const tbody = document.getElementById('adminEventsTableBody');
    if (!Array.isArray(events)) return;
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No events found.</td></tr>';
        return;
    }

    tbody.innerHTML = events.map(e => {
        const dateObj = new Date(e.event_datetime);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const badgeClass = `status-${e.status ? e.status.toLowerCase() : 'scheduled'}`;
        const safeTitle = e.event_title.replace(/'/g, "\\'");
        const safeDesc = (e.description || '').replace(/'/g, "\\'").replace(/\n/g, " ");

        return `
        <tr>
            <td><strong>${e.event_title}</strong></td>
            <td>${e.movie_title}</td>
            <td>${dateStr}</td>
            <td>${e.host_name}</td>
            <td><span class="status-badge ${badgeClass}">${e.status}</span></td>
            <td>
                <button class="action-btn edit" onclick="openEventModal('edit', '${e.event_id}', '${safeTitle}', '${e.movie_id}', '${e.event_datetime}', '${safeDesc}')">Edit</button>
                <button class="action-btn danger" onclick="cancelEvent(${e.event_id})">Cancel</button>
            </td>
        </tr>`;
    }).join('');
}

function filterEvents() {
    const term = document.getElementById('eventSearchInput').value.toLowerCase();
    const filtered = allEventsCache.filter(e => 
        e.event_title.toLowerCase().includes(term) || 
        e.host_name.toLowerCase().includes(term) ||
        e.movie_title.toLowerCase().includes(term)
    );
    renderEventsTable(filtered);
}

async function openEventModal(mode = 'create', id = '', title = '', movieId = '', datetime = '', desc = '') {
    const modal = document.getElementById('eventModal');
    const select = document.getElementById('movieSelectDropdown');
    
    try {
        const res = await fetch('/api/movies');
        const movies = await res.json();
        if(Array.isArray(movies)) {
            select.innerHTML = movies.map(m => `<option value="${m.movie_id}">${m.title} (${m.release_year})</option>`).join('');
        }
    } catch (err) { select.innerHTML = '<option>Error loading movies</option>'; }

    if (mode === 'edit') {
        document.getElementById('modalTitle').innerText = "Edit Event Details";
        document.getElementById('modalSubmitBtn').innerText = "Save Changes";
        document.getElementById('eventIdInput').value = id;
        document.getElementById('eventTitleInput').value = title;
        document.getElementById('movieSelectDropdown').value = movieId;
        document.getElementById('eventDescInput').value = desc;
        
        const dt = new Date(datetime);
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        document.getElementById('eventDateInput').value = dt.toISOString().slice(0, 16);
    } else {
        document.getElementById('modalTitle').innerText = "Schedule New Event";
        document.getElementById('modalSubmitBtn').innerText = "Publish Event";
        document.getElementById('eventForm').reset();
        document.getElementById('eventIdInput').value = ''; 
    }
    if(modal) modal.style.display = 'flex';
}

function closeEventModal() {
    const modal = document.getElementById('eventModal');
    if(modal) modal.style.display = 'none';
}

async function handleEventFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    const isEdit = data.event_id && data.event_id !== '';
    const endpoint = '/api/admin/events';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert(isEdit ? "Event Updated!" : "Event Published!");
            closeEventModal();
            loadAdminEvents(); 
            if (!isEdit) e.target.reset();
        } else { alert("Error: " + result.error); }
    } catch (err) { alert("Server error"); }
}

async function cancelEvent(eventId) {
    if(!confirm("Are you sure?")) return;
    try {
        const res = await fetch('/api/admin/events/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: eventId })
        });
        const result = await res.json();
        if(result.success) loadAdminEvents();
    } catch (err) { alert("Server error"); }
}

// ==========================================
// 4. ADMIN: MANAGE MOVIES
// ==========================================

async function loadAdminMovies() {
    const tbody = document.getElementById('adminMoviesTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/movies');
        const movies = await res.json();

        if (!Array.isArray(movies)) {
            console.error("Server Response:", movies);
            throw new Error(movies.error || "Invalid response format");
        }

        if (movies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No movies in database.</td></tr>';
            return;
        }

        tbody.innerHTML = movies.map(m => {
            const safeTitle = m.title.replace(/'/g, "\\'");
            const safeSyn = (m.synopsis || '').replace(/'/g, "\\'").replace(/\n/g, " ");
            const safePoster = (m.poster_image || '').replace(/'/g, "\\'");
            const genreIdsStr = m.genre_ids || '';

            return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${m.poster_image || 'https://via.placeholder.com/40'}" style="width:40px; height:60px; object-fit:cover; border-radius:4px;" onerror="this.src='https://via.placeholder.com/40?text=No+Img'">
                        <strong>${m.title}</strong>
                    </div>
                </td>
                <td>${m.release_year}</td>
                <td>${m.genre_name || 'None'}</td>
                <td>${m.duration_minutes || '--'}</td>
                <td>
                    <button class="action-btn edit" onclick="openMovieModal('edit', ${m.movie_id}, '${safeTitle}', ${m.release_year}, ${m.duration_minutes}, '${safeSyn}', '${genreIdsStr}', '${safePoster}')">Edit</button>
                    <button class="action-btn delete" onclick="deleteMovie(${m.movie_id})">Delete</button>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error loading movies: ${err.message}</td></tr>`;
    }
}

async function openMovieModal(mode = 'create', id='', title='', year='', duration='', synopsis='', genreIdsStr='', poster='') {
    const modal = document.getElementById('movieModal');
    const container = document.getElementById('genreCheckboxContainer');
    const modalTitle = document.getElementById('modalTitle');
    const submitBtn = document.getElementById('modalSubmitBtn');

    // Load Genres and build checkboxes
    try {
        const res = await fetch('/api/genres');
        const genres = await res.json();
        
        const selectedIds = genreIdsStr ? String(genreIdsStr).split(',').map(s => s.trim()) : [];

        if(Array.isArray(genres)) {
            container.innerHTML = genres.map(g => {
                const isChecked = selectedIds.includes(String(g.genre_id)) ? 'checked' : '';
                return `
                <label class="genre-checkbox">
                    <input type="checkbox" name="genres" value="${g.genre_id}" ${isChecked}>
                    ${g.genre_name}
                </label>
                `;
            }).join('');
        }
    } catch(e) { container.innerHTML = 'Error loading genres'; }

    if (mode === 'edit') {
        modalTitle.innerText = "Edit Movie";
        submitBtn.innerText = "Update Movie";
        document.getElementById('movieIdInput').value = id;
        document.getElementById('movieTitleInput').value = title;
        document.getElementById('moviePosterInput').value = poster;
        document.getElementById('movieYearInput').value = year;
        document.getElementById('movieDurationInput').value = duration;
        document.getElementById('movieSynopsisInput').value = synopsis;
    } else {
        modalTitle.innerText = "Add New Movie";
        submitBtn.innerText = "Save Movie";
        document.getElementById('movieForm').reset();
        document.getElementById('movieIdInput').value = '';
    }
    modal.style.display = 'flex';
}

function closeMovieModal() {
    document.getElementById('movieModal').style.display = 'none';
}

async function handleMovieSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const checkboxes = document.querySelectorAll('input[name="genres"]:checked');
    const selectedGenres = Array.from(checkboxes).map(cb => cb.value);

    const data = {
        movie_id: formData.get('movie_id'),
        title: formData.get('title'),
        poster_image: formData.get('poster_image'),
        release_year: formData.get('release_year'),
        duration_minutes: formData.get('duration_minutes'),
        synopsis: formData.get('synopsis'),
        genres: selectedGenres 
    };

    const isEdit = data.movie_id && data.movie_id !== '';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch('/api/admin/movies', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert(isEdit ? "Movie Updated!" : "Movie Added!");
            closeMovieModal();
            loadAdminMovies();
        } else { alert("Error: " + result.error); }
    } catch (err) { alert("Server error"); }
}

async function deleteMovie(id) {
    if(!confirm("Delete this movie? This will also remove it from any Watchlists or Events.")) return;
    try {
        const res = await fetch(`/api/admin/movies/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if(result.success) loadAdminMovies();
    } catch(err) { alert("Server error"); }
}

// ==========================================
// 5. ADMIN: MANAGE POSTS & MODERATION
// ==========================================

async function loadManagePosts() {
    const tbody = document.getElementById('adminPostsTableBody');
    if(!tbody) return;

    try {
        const res = await fetch('/api/admin/posts');
        const posts = await res.json();

        if(posts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No posts found.</td></tr>';
            return;
        }

        tbody.innerHTML = posts.map(p => {
            const snippet = p.content.length > 50 ? p.content.substring(0, 50) + '...' : p.content;
            return `
            <tr>
                <td>${p.author}</td>
                <td>${snippet}</td>
                <td>${new Date(p.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="view" onclick="openPostModeration(${p.post_id})">Comments</button>
                    <button class="delete" onclick="deletePostAdmin(${p.post_id})">Delete</button>
                </td>
            </tr>
            `;
        }).join('');
    } catch(err) { console.error(err); }
}

async function openPostModeration(postId) {
    const modal = document.getElementById('postCommentsModal');
    const list = document.getElementById('adminCommentsList');
    
    modal.style.display = 'flex';
    list.innerHTML = '<li style="color:#777;">Loading comments...</li>';
    
    try {
        const res = await fetch(`/api/admin/posts/${postId}/comments`);
        const comments = await res.json();
        
        if(comments.length === 0) {
            list.innerHTML = '<li style="color:#777;">No comments on this post.</li>';
            return;
        }

        list.innerHTML = comments.map(c => `
            <li class="admin-comment-item">
                <div>
                    <span class="comment-meta">${c.author}</span>
                    <span class="comment-body">${c.content}</span>
                </div>
                <button class="delete" style="padding:4px 8px; font-size:0.7rem;" onclick="deleteCommentAdmin(${c.comment_id}, ${postId})">Delete</button>
            </li>
        `).join('');
    } catch(err) {
        list.innerHTML = '<li style="color:red;">Error loading comments.</li>';
    }
}

async function deletePostAdmin(id) {
    if(!confirm("Delete this post? All comments will also be removed.")) return;
    try {
        const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if(result.success) loadManagePosts();
    } catch(err) { alert("Server error"); }
}

async function deleteCommentAdmin(commentId, postId) {
    if(!confirm("Delete this comment?")) return;
    try {
        const res = await fetch(`/api/admin/comments/${commentId}`, { method: 'DELETE' });
        const result = await res.json();
        if(result.success) {
            openPostModeration(postId); // Refresh modal
        }
    } catch(err) { alert("Server error"); }
}

// --- MODERATION & RESTRICTED WORDS ---

async function loadRestrictedWordsPage() {
    const list = document.getElementById('restrictedWordsList');
    if(!list) return;

    try {
        const res = await fetch('/api/restricted-words');
        const words = await res.json();

        if(words.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#777;">No restricted words.</li>';
            return;
        }

        list.innerHTML = words.map(w => `
            <li>
                <span>${w.restricted_word}</span>
                <button class="delete-btn" onclick="deleteRestrictedWord(${w.word_id})">Delete</button>
            </li>
        `).join('');
    } catch(err) {
        list.innerHTML = '<li>Error loading words.</li>';
    }
}

async function handleAddWord(e) {
    e.preventDefault();
    const input = document.getElementById('newWordInput');
    const word = input.value.trim();
    if(!word) return;

    try {
        const res = await fetch('/api/restricted-words', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ word: word })
        });
        const result = await res.json();
        if(result.success) {
            input.value = '';
            loadRestrictedWordsPage();
        } else {
            alert("Error adding word");
        }
    } catch(err) { alert("Server error"); }
}

async function deleteRestrictedWord(id) {
    if(!confirm("Delete this restricted word?")) return;
    try {
        await fetch(`/api/restricted-words/${id}`, { method: 'DELETE' });
        loadRestrictedWordsPage();
    } catch(err) { alert("Server error"); }
}

async function loadModerationQueue() {
    const list = document.getElementById('moderationQueue');
    if(!list) return;

    try {
        const res = await fetch('/api/admin/moderation');
        const items = await res.json();

        if(items.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#777;">No flagged content.</li>';
            return;
        }

        list.innerHTML = items.map(i => `
            <li class="flagged-item">
                <div>
                    <span class="flagged-content" style="color: #ff4d4d;">"${i.content}"</span>
                    <span class="flagged-meta">${i.type.toUpperCase()} by ${i.author}</span>
                </div>
                <div>
                    <button class="mod-btn btn-approve" onclick="moderateContent('${i.type}', ${i.id}, 'approve')">Approve</button>
                    <button class="mod-btn btn-reject" onclick="moderateContent('${i.type}', ${i.id}, 'reject')">Delete</button>
                </div>
            </li>
        `).join('');
    } catch(err) {
        list.innerHTML = '<li>Error loading queue.</li>';
    }
}

async function moderateContent(type, id, action) {
    if(!confirm(`${action === 'approve' ? 'Restore' : 'Permanently Delete'} this content?`)) return;
    
    try {
        const res = await fetch('/api/admin/moderation', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ type, id, action })
        });
        const result = await res.json();
        if(result.success) {
            loadModerationQueue();
        } else {
            alert("Action failed");
        }
    } catch(err) { alert("Server error"); }
}

// ADMIN: REPORTS (UPDATED)
let currentReportData = [];
async function generateReport(type, title) {
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportContent');
    const dateEl = document.getElementById('reportDate');
    
    document.getElementById('reportTitle').innerText = title;
    if(dateEl) dateEl.innerText = "Generated on: " + new Date().toLocaleString();
    
    modal.style.display = 'flex';
    content.innerHTML = '<p>Generating...</p>';

    try {
        const res = await fetch(`/api/reports/${type}`);
        const data = await res.json();
        currentReportData = data;

        if (data.length === 0) { content.innerHTML = '<p>No data available.</p>'; return; }

        let html = '<table class="report-table"><thead><tr>';
        Object.keys(data[0]).forEach(key => {
            html += `<th>${key.replace(/_/g, ' ').toUpperCase()}</th>`;
        });
        html += '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>';
            Object.values(row).forEach(val => { html += `<td>${val}</td>`; });
            html += '</tr>';
        });
        html += '</tbody></table>';
        content.innerHTML = html;
    } catch(err) { content.innerHTML = 'Error generating report.'; }
}

function exportToCSV() {
    if (!currentReportData || currentReportData.length === 0) { alert("No data"); return; }
    const keys = Object.keys(currentReportData[0]);
    let csv = keys.join(',') + '\n';
    currentReportData.forEach(row => { csv += keys.map(k => `"${row[k]}"`).join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report_export.csv';
    a.click();
}

// ==========================================
// 6. POSTS & SOCIAL ENGAGEMENT (USER)
// ==========================================

async function loadCommunityPosts() {
    const feed = document.getElementById('communityFeed');
    if(!feed) return;

    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();

        if (posts.length === 0) {
            feed.innerHTML = '<div style="text-align:center; color:#777;">No posts yet. Be the first!</div>';
            return;
        }

        feed.innerHTML = posts.map(p => `
            <div class="post-card" id="post-${p.post_id}">
                <div class="post-header">
                    <span class="post-author">${p.author_name}</span>
                    <span class="post-movie">watching ${p.movie_title}</span>
                </div>
                <div class="post-content">${p.content}</div>
                <div class="post-actions">
                    <button class="action-btn" onclick="handleLikePost(${p.post_id})">
                        ♥ <span id="like-count-${p.post_id}">${p.like_count}</span> Likes
                    </button>
                    <button class="action-btn" onclick="toggleComments(${p.post_id})">
                        💬 <span id="comment-count-${p.post_id}">${p.comment_count}</span> Comments
                    </button>
                </div>
                <div class="comments-section" id="comments-section-${p.post_id}">
                    <ul class="comment-list" id="comment-list-${p.post_id}"></ul>
                    <form class="comment-form" onsubmit="submitComment(event, ${p.post_id})">
                        <input type="text" class="comment-input" placeholder="Write a comment..." required>
                        <button type="submit" class="comment-submit">Send</button>
                    </form>
                </div>
            </div>
        `).join('');
    } catch (err) {
        feed.innerHTML = '<div style="color:red;">Error loading feed.</div>';
    }
}

async function populateMovieDropdown() {
    const select = document.getElementById('postMovieSelect');
    if(!select) return;
    try {
        const res = await fetch('/api/movies');
        const movies = await res.json();
        if(Array.isArray(movies)) {
            select.innerHTML += movies.map(m => `<option value="${m.movie_id}">${m.title}</option>`).join('');
        }
    } catch(e) {}
}

async function handleCreatePost(e) {
    e.preventDefault();
    const movieId = document.getElementById('postMovieSelect').value;
    const content = document.getElementById('postContent').value;

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ movie_id: movieId, content: content })
        });
        const result = await res.json();
        if(result.success) {
            alert("Post Created!");
            document.getElementById('postContent').value = '';
            loadCommunityPosts(); 
        } else {
            alert("Error: " + result.error);
        }
    } catch(err) { alert("Server error"); }
}

async function handleLikePost(postId) {
    try {
        const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
        const result = await res.json();
        if(result.success) {
            const countEl = document.getElementById(`like-count-${postId}`);
            countEl.innerText = parseInt(countEl.innerText) + 1;
        } else {
            alert(result.error);
        }
    } catch(err) { alert("Server error"); }
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if (section.style.display === 'block') {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
        loadPostComments(postId);
    }
}

async function loadPostComments(postId) {
    const list = document.getElementById(`comment-list-${postId}`);
    try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        const comments = await res.json();
        list.innerHTML = comments.map(c => `
            <li class="comment-item">
                <span class="comment-author">${c.author_name}:</span> ${c.content}
            </li>
        `).join('');
    } catch(e) { list.innerHTML = '<li>Error loading comments</li>'; }
}

async function submitComment(e, postId) {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const content = input.value;

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ content: content })
        });
        const result = await res.json();
        if(result.success) {
            input.value = '';
            loadPostComments(postId);
            const countEl = document.getElementById(`comment-count-${postId}`);
            countEl.innerText = parseInt(countEl.innerText) + 1;
        } else {
            alert(result.error);
        }
    } catch(err) { alert("Server error"); }
}

// ==========================================
// 7. USER: BROWSE MOVIES
// ==========================================

let userMoviesCache = []; 

async function loadUserMovies() {
    const container = document.querySelector('.movie-cards');
    if(!container) return;

    try {
        const res = await fetch('/api/movies');
        userMoviesCache = await res.json();

        if (!Array.isArray(userMoviesCache)) {
            container.innerHTML = '<p style="color:red;">Error loading movies.</p>';
            return;
        }

        if (userMoviesCache.length === 0) {
            container.innerHTML = '<p style="color:#aaa;">No movies available in the database yet.</p>';
            return;
        }

        container.innerHTML = userMoviesCache.map(m => `
            <div class="movie-card" onclick="openUserMovieModal(${m.movie_id})">
              <img src="${m.poster_image || 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${m.title}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
              <div class="movie-info">
                <span class="tag ${m.genre_name ? m.genre_name.toLowerCase() : ''}">${m.title}</span>
                <span class="year">${m.release_year}</span>
                <span class="rating">⭐ ${Number(m.average_rating || 0).toFixed(1)}</span>
                <span class="genre">${m.genre_name || 'General'}</span>
              </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading user movies", err);
        container.innerHTML = '<p style="color:red;">Network Error.</p>';
    }
}

let currentModalMovieId = null;
function setCurrentModalMovie(id) { currentModalMovieId = id; }

function openUserMovieModal(movieId) {
    const movie = userMoviesCache.find(m => m.movie_id === movieId);
    if (!movie) return;

    setCurrentModalMovie(movieId);

    document.getElementById('detailPoster').src = movie.poster_image || 'https://via.placeholder.com/300x450?text=No+Image';
    document.getElementById('detailTitle').innerText = movie.title;
    document.getElementById('detailYear').innerText = movie.release_year;
    document.getElementById('detailDuration').innerText = (movie.duration_minutes || '--') + " min";
    document.getElementById('detailGenre').innerText = movie.genre_name || 'Unassigned';
    document.getElementById('detailRating').innerText = Number(movie.average_rating || 0).toFixed(1);
    document.getElementById('detailSynopsis').innerText = movie.synopsis || 'No synopsis available.';

    loadMovieReviews(movieId);
    loadForumPosts(movieId);

    document.getElementById('userMovieModal').style.display = 'flex';
}

function closeUserMovieModal() {
    document.getElementById('userMovieModal').style.display = 'none';
}

// ==========================================
// 8. USER: BROWSE & JOIN & HOST EVENTS
// ==========================================

async function loadUserEvents() {
    const list = document.getElementById('userEventsList');
    if(!list) return;

    try {
        const res = await fetch('/api/events');
        const events = await res.json();

        if (!Array.isArray(events) || events.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#aaa; padding:20px;">No upcoming events scheduled.</li>';
            return;
        }

        list.innerHTML = events.map(e => {
            const safeTitle = e.event_title.replace(/'/g, "\\'");
            const safeDesc = (e.description || '').replace(/'/g, "\\'").replace(/\n/g, " ");
            const safeHost = (e.host_name || 'Admin').replace(/'/g, "\\'");
            const safeDate = new Date(e.event_datetime).toLocaleString();
            const movieTitle = e.movie_title.replace(/'/g, "\\'");

            return `
            <li>
                <a class="event-link" href="javascript:void(0)" 
                   onclick="showEventDetails('${safeTitle}', '${safeHost}', '${safeDate}', '${safeDesc}', '${movieTitle}', ${e.max_participants}, ${e.event_id})">
                   <span>${e.event_title}</span>
                   <span style="font-size:0.85rem; color:#aaa;">${safeDate}</span>
                </a>
            </li>
            `;
        }).join('');
    } catch (err) {
        list.innerHTML = '<li>Error loading events.</li>';
    }
}

function showEventDetails(title, host, date, desc, movie, capacity, eventId) {
    document.getElementById('eventsListCard').style.display = 'none';
    const detailsCard = document.getElementById('eventDetailsCard');
    detailsCard.style.display = 'block';

    const content = document.getElementById('eventDetailsContent');
    if(content) {
        content.innerHTML = `
            <h3 style="margin-top:0; color:var(--accent); font-size:1.5rem;">${title}</h3>
            <p><strong>Movie:</strong> ${movie}</p>
            <p><strong>Host:</strong> ${host}</p>
            <p><strong>Time:</strong> ${date}</p>
            <p><strong>Capacity:</strong> ${capacity} Participants</p>
            <hr style="border:0; border-top:1px solid #444; margin:15px 0;">
            <p><strong>Description:</strong><br>${desc || 'No details provided.'}</p>
            <button class="join-btn" onclick="joinEvent(${eventId})">Join Event</button>
        `;
    }
}

async function joinEvent(eventId) {
    try {
        const res = await fetch(`/api/events/${eventId}/join`, { method: 'POST' });
        const result = await res.json();
        if(result.success) {
            alert("You have successfully joined the event!");
        } else {
            alert("Failed: " + result.error);
        }
    } catch(err) { alert("Server error"); }
}

async function openHostEventModal() {
    const modal = document.getElementById('hostEventModal');
    const select = document.getElementById('hostMovieSelect');
    
    try {
        const res = await fetch('/api/movies');
        const movies = await res.json();
        if(Array.isArray(movies)) {
            select.innerHTML = movies.map(m => `<option value="${m.movie_id}">${m.title} (${m.duration_minutes || 120} min)</option>`).join('');
        }
    } catch(e) {}
    
    modal.style.display = 'flex';
}

async function handleHostEventSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch('/api/user/events', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if(result.success) {
            alert("Event Hosted Successfully!");
            document.getElementById('hostEventModal').style.display='none';
            loadUserEvents();
        } else {
            alert("Error: " + result.error);
        }
    } catch(err) { alert("Server error"); }
}

// ==========================================
// 9. FRIENDS SYSTEM & CHAT
// ==========================================

async function loadFriendsPage() {
    loadPendingRequests();
    loadFriendsList();
}

async function searchUsers() {
    const input = document.getElementById('userSearchInput');
    const list = document.getElementById('searchResultsList');
    const term = input.value.trim();
    if(!term) return;

    try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`);
        const users = await res.json();
        
        if(users.length === 0) {
            list.innerHTML = '<li class="empty-msg">No users found.</li>';
            return;
        }

        list.innerHTML = users.map(u => `
            <li class="user-item">
                <div class="user-info">
                    <div class="avatar">${u.name.charAt(0).toUpperCase()}</div>
                    <div class="user-details">
                        <span class="user-name">${u.name}</span>
                        <span class="user-email">${u.email}</span>
                    </div>
                </div>
                <button class="action-btn btn-add" onclick="sendFriendRequest(${u.user_id})">Add Friend</button>
            </li>
        `).join('');
    } catch(err) { console.error(err); }
}

async function sendFriendRequest(userId) {
    try {
        const res = await fetch('/api/friends/request', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ receiver_id: userId })
        });
        const data = await res.json();
        if(data.success) {
            alert("Request Sent!");
            document.getElementById('searchResultsList').innerHTML = ''; 
            document.getElementById('userSearchInput').value = '';
        } else {
            alert("Failed: " + (data.error || "Unknown error"));
        }
    } catch(err) { alert("Server error"); }
}

async function loadPendingRequests() {
    const list = document.getElementById('pendingRequestsList');
    try {
        const res = await fetch('/api/friends/requests');
        const reqs = await res.json();

        if(reqs.length === 0) {
            list.innerHTML = '<li class="empty-msg">No pending requests.</li>';
            return;
        }

        list.innerHTML = reqs.map(r => `
            <li class="user-item">
                <div class="user-info">
                    <div class="avatar" style="background:#555;">?</div>
                    <div class="user-details">
                        <span class="user-name">${r.name}</span>
                        <span class="user-email">Wants to connect</span>
                    </div>
                </div>
                <div>
                    <button class="action-btn btn-accept" onclick="respondToRequest(${r.request_id}, 'accepted')">Accept</button>
                    <button class="action-btn btn-decline" onclick="respondToRequest(${r.request_id}, 'declined')">Decline</button>
                </div>
            </li>
        `).join('');
    } catch(err) { console.error(err); }
}

async function respondToRequest(reqId, action) {
    try {
        const res = await fetch('/api/friends/respond', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ request_id: reqId, action: action })
        });
        const data = await res.json();
        if(data.success) {
            loadPendingRequests(); 
            loadFriendsList();     
        } else {
            alert("Error updating request");
        }
    } catch(err) { alert("Server error"); }
}

async function loadFriendsList() {
    const list = document.getElementById('friendsList');
    try {
        const res = await fetch('/api/friends');
        const friends = await res.json();

        if(friends.length === 0) {
            list.innerHTML = '<li class="empty-msg">You haven\'t added any friends yet.</li>';
            return;
        }

        list.innerHTML = friends.map(f => `
            <li class="user-item">
                <div class="user-info">
                    <div class="avatar" style="background:#27ae60;">${f.name.charAt(0).toUpperCase()}</div>
                    <div class="user-details">
                        <span class="user-name">${f.name}</span>
                        <span class="user-email">${f.email}</span>
                    </div>
                </div>
                <div style="display:flex;">
                    <button class="action-btn btn-msg" onclick="openChatModal(${f.user_id}, '${f.name}')">Message</button>
                    <button class="action-btn" style="border:1px solid #aaa;" onclick="viewFriendProfile(${f.user_id})">Profile</button>
                </div>
            </li>
        `).join('');
    } catch(err) { console.error(err); }
}

// --- PRIVATE CHAT ---

let currentChatFriendId = null;

async function openChatModal(friendId, friendName) {
    currentChatFriendId = friendId;
    document.getElementById('chatFriendName').innerText = friendName;
    document.getElementById('chatModal').style.display = 'flex';
    loadMessages(friendId);
}

async function loadMessages(friendId) {
    const body = document.getElementById('chatBody');
    body.innerHTML = 'Loading...';
    const res = await fetch(`/api/messages/${friendId}`);
    const msgs = await res.json();
    
    body.innerHTML = msgs.map(m => `
        <div class="msg ${m.type === 'sent' ? 'msg-sent' : 'msg-received'}">
            ${m.content}
            <div style="display:flex; justify-content:flex-end; align-items:center; gap:5px;">
                <span class="msg-time">${new Date(m.sent_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                ${m.type === 'sent' && m.is_read ? '<span style="font-size:0.8rem;">✓✓</span>' : ''}
            </div>
        </div>
    `).join('');
    
    body.scrollTop = body.scrollHeight; 
    await fetch(`/api/messages/read/${friendId}`, { method: 'PUT' });
}

async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    if(!content) return;
    
    await fetch('/api/messages', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ receiver_id: currentChatFriendId, content: content })
    });
    
    input.value = '';
    loadMessages(currentChatFriendId);
}

async function viewFriendProfile(friendId) {
    const modal = document.getElementById('friendProfileModal');
    const postsList = document.getElementById('fpPostsList');
    
    modal.style.display = 'flex';
    postsList.innerHTML = '<li>Loading posts...</li>';
    
    try {
        const res = await fetch(`/api/users/${friendId}/profile`);
        const data = await res.json();
        
        if (data.error) {
            alert(data.error);
            closeFriendProfileModal();
            return;
        }

        document.getElementById('fpName').innerText = data.user.name;
        document.getElementById('fpEmail').innerText = data.user.email;
        document.getElementById('fpAvatar').innerText = data.user.name.charAt(0).toUpperCase();

        if (data.posts.length === 0) {
            postsList.innerHTML = '<li style="color:#777; padding:10px;">No posts yet.</li>';
        } else {
            postsList.innerHTML = data.posts.map(p => `
                <li class="friend-post-item">
                    <span class="post-movie">About: <strong>${p.movie_title || 'General'}</strong></span>
                    <div class="post-content">${p.content}</div>
                    <div style="margin-top:5px; font-size:0.8rem; color:#666;">${new Date(p.created_at).toLocaleDateString()}</div>
                </li>
            `).join('');
        }

    } catch(err) {
        alert("Error loading profile");
        closeFriendProfileModal();
    }
}

function closeFriendProfileModal() {
    document.getElementById('friendProfileModal').style.display = 'none';
}

// ==========================================
// 10. WATCHLIST & REVIEWS & FORUM & NOTIFICATIONS
// ==========================================

async function saveToWatchlist() {
    if(!currentModalMovieId) return;
    const status = document.getElementById('watchlistStatusSelect').value;

    try {
        const res = await fetch('/api/watchlist', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ movie_id: currentModalMovieId, status: status })
        });
        const data = await res.json();
        if(data.success) {
            alert(`Movie added to "${status}" list!`);
        } else {
            alert("Failed to update watchlist");
        }
    } catch(err) { alert("Server error"); }
}

async function loadUserWatchlist() {
    const list = document.getElementById('userWatchlist');
    if(!list) return;

    try {
        const res = await fetch('/api/watchlist');
        const items = await res.json();

        if(items.length === 0) {
            list.innerHTML = '<li style="color:#777; font-style:italic;">Your watchlist is empty. Go to Movies to add some!</li>';
            return;
        }

        list.innerHTML = items.map(i => `
            <li>
                <div style="display:flex; align-items:center; gap:10px;">
                    <strong>${i.title}</strong>
                    <span style="font-size:0.8rem; color:#888;">(Last update: ${new Date(i.updated_at).toLocaleDateString()})</span>
                </div>
                <span class="status-badge status-${i.status}">${i.status}</span>
            </li>
        `).join('');
    } catch(err) {
        list.innerHTML = '<li>Error loading watchlist.</li>';
    }
}

async function loadUserHistory() {
    const list = document.getElementById('userHistoryList');
    if(!list) return;

    try {
        const res = await fetch('/api/user/history');
        const items = await res.json();

        if(items.length === 0) {
            list.innerHTML = '<li style="color:#777; font-style:italic;">No history records found.</li>';
            return;
        }

        list.innerHTML = items.map(i => `
            <li>
                <div style="display:flex; align-items:center; gap:10px;">
                    <strong>${i.title}</strong>
                    <span class="history-date">${new Date(i.action_date).toLocaleString()}</span>
                </div>
                <span class="status-badge" style="background:#444; color:#ccc; font-size:0.75rem;">${i.action_type.replace(/_/g, ' ')}</span>
            </li>
        `).join('');
    } catch(err) {
        list.innerHTML = '<li>Error loading history.</li>';
    }
}

async function loadNotifications() {
    const list = document.getElementById('notificationList');
    if(!list) return;

    try {
        const res = await fetch('/api/notifications');
        const notifs = await res.json();

        if(notifs.length === 0) {
            list.innerHTML = '<li style="color:#777;">No new notifications.</li>';
            return;
        }

        list.innerHTML = notifs.map(n => `
            <li>
                <div>
                    <span class="notif-new">NEW</span>
                    <span class="notif-msg">${n.message}</span>
                </div>
                <span class="history-date">${new Date(n.created_at).toLocaleTimeString()}</span>
            </li>
        `).join('');
    } catch(err) {
        list.innerHTML = '<li>Error loading notifications.</li>';
    }
}

async function markNotificationsRead() {
    try {
        await fetch('/api/notifications/read', { method: 'PUT' });
        loadNotifications(); // Refresh list (should be empty now)
        updateNotificationBadge(); // Update badge count
    } catch(err) { alert("Server Error"); }
}

async function loadMovieReviews(movieId) {
    const container = document.getElementById('reviewsList');
    container.innerHTML = '<p style="color:#777;">Loading reviews...</p>';

    try {
        const res = await fetch(`/api/movies/${movieId}/reviews`);
        const reviews = await res.json();

        if(reviews.length === 0) {
            container.innerHTML = '<p style="color:#777;">No reviews yet. Be the first!</p>';
            return;
        }

        container.innerHTML = reviews.map(r => `
            <div class="review-item">
                <div class="review-header">
                    <span class="review-user">${r.user_name}</span>
                    <span class="review-rating">⭐ ${r.rating}/10</span>
                </div>
                <div class="review-text">${r.review_text}</div>
                <div style="font-size:0.75rem; color:#666; margin-top:4px;">${new Date(r.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    } catch(err) {
        container.innerHTML = '<p style="color:red;">Error loading reviews.</p>';
    }
}

async function submitReview(e) {
    e.preventDefault();
    if(!currentModalMovieId) return;

    const rating = document.getElementById('reviewRatingInput').value;
    const text = document.getElementById('reviewTextInput').value;

    try {
        const res = await fetch(`/api/movies/${currentModalMovieId}/reviews`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ rating: rating, review_text: text })
        });
        const result = await res.json();

        if(result.success) {
            alert("Review Submitted!");
            document.getElementById('reviewTextInput').value = '';
            loadMovieReviews(currentModalMovieId); // Refresh reviews
            loadUserMovies(); // Refresh movie grid (update avg rating)
        } else {
            alert("Error: " + result.error);
        }
    } catch(err) { alert("Server error"); }
}

async function loadForumPosts(movieId) {
    const container = document.getElementById('forumPostsList');
    container.innerHTML = '<p style="color:#777;">Loading forum...</p>';

    try {
        const res = await fetch(`/api/movies/${movieId}/forum`);
        const posts = await res.json();

        if(posts.length === 0) {
            container.innerHTML = '<p style="color:#777;">No posts yet. Start the discussion!</p>';
            return;
        }

        container.innerHTML = posts.map(p => `
            <div class="forum-post">
                <div>
                    <span class="forum-user">${p.user_name}</span>
                    <span class="forum-date">${new Date(p.created_at).toLocaleString()}</span>
                </div>
                <div class="forum-text">${p.content}</div>
            </div>
        `).join('');
    } catch(err) {
        container.innerHTML = '<p style="color:red;">Error loading forum.</p>';
    }
}

async function submitForumPost(e) {
    e.preventDefault();
    if(!currentModalMovieId) return;

    const text = document.getElementById('forumTextInput').value;

    try {
        const res = await fetch(`/api/movies/${currentModalMovieId}/forum`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ content: text })
        });
        const result = await res.json();

        if(result.success) {
            alert("Posted!");
            document.getElementById('forumTextInput').value = '';
            loadForumPosts(currentModalMovieId); // Refresh forum
        } else {
            alert("Error: " + result.error);
        }
    } catch(err) { alert("Server error"); }
}

// ==========================================
// 11. DASHBOARD ANALYTICS & HELPERS
// ==========================================

async function loadUserDashboard() {
    if(!document.getElementById('dash-posts')) return;

    try {
        const res = await fetch('/api/user/dashboard');
        const data = await res.json();
        
        document.getElementById('dash-posts').innerText = data.postCount || 0;
        document.getElementById('dash-completed').innerText = data.completedCount || 0;
        
        if(document.getElementById('welcome-msg')) {
             document.getElementById('welcome-msg').innerText = `Hello, ${data.user.name}!`;
        }
    } catch(e) { console.error(e); }
}

async function loadUserRecommendations() {
    const list = document.getElementById('recList');
    if(!list) return;
    try {
        const res = await fetch('/api/user/recommendations');
        const movies = await res.json();
        if(movies.length === 0) {
            list.innerHTML = '<li style="color:#777;">No recommendations yet.</li>';
            return;
        }
        list.innerHTML = movies.map(m => `
            <li class="rec-item" onclick="openUserMovieModal(${m.movie_id})">
                <img src="${m.poster_image || 'https://via.placeholder.com/150'}" alt="${m.title}">
                <div class="rec-info">
                    <span class="rec-title">${m.title}</span>
                    <span class="rec-rating">⭐ ${Number(m.rating).toFixed(1)}</span>
                </div>
            </li>
        `).join('');
    } catch(e) { list.innerHTML = '<li>Error loading recs</li>'; }
}

async function loadTrendingMovies() {
    const list = document.getElementById('trendingGrid');
    if(!list) return;
    try {
        const res = await fetch('/api/user/trending');
        const movies = await res.json();
        if(movies.length === 0) {
            list.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#777;">No trending data yet.</div>';
            return;
        }
        list.innerHTML = movies.map(m => `
            <div class="trend-item" onclick="openUserMovieModal(${m.movie_id})">
                <img src="${m.poster_image || 'https://via.placeholder.com/150'}" alt="${m.title}">
                <div class="trend-info">
                    <span class="trend-title">${m.title}</span>
                    <span class="trend-views">${m.views} completions</span>
                </div>
            </div>
        `).join('');
    } catch(e) { list.innerHTML = '<div>Error loading trends</div>'; }
}

async function loadGenres() {
    const list = document.querySelector('.genre-list');
    if(list) {
        try {
            const res = await fetch('/api/genres');
            const genres = await res.json();
            if (Array.isArray(genres)) {
                list.innerHTML = genres.map(g => `<li>${g.genre_name}</li>`).join('');
            }
        } catch(e) { console.error(e); }
    }
}

async function loadRestrictedWords() {
    const list = document.querySelector('.restrict-list');
    if(list) {
        try {
            const res = await fetch('/api/restricted-words');
            const w = await res.json();
            if (Array.isArray(w)) {
                list.innerHTML = w.map(word => `<li>${word.restricted_word}</li>`).join('');
            }
        } catch(e) { console.error(e); }
    }
}

async function loadAdminStats() {
    if(document.getElementById('stat-users')) {
        try {
            const res = await fetch('/api/admin/stats');
            const stats = await res.json();
            
            document.getElementById('stat-users').innerText = stats.users || 0;
            document.getElementById('stat-movies').innerText = stats.movies || 0;
            document.getElementById('stat-posts').innerText = stats.posts || 0;
            
            if(document.getElementById('stat-completed')) {
                document.getElementById('stat-completed').innerText = stats.completed_movies || 0;
            }

            const trendingList = document.getElementById('trendingList');
            if (trendingList && stats.trending) {
                if (stats.trending.length === 0) {
                    trendingList.innerHTML = '<li style="color:#777; padding:10px;">No data available.</li>';
                } else {
                    trendingList.innerHTML = stats.trending.map(m => `
                        <li class="trending-item">
                            <span>${m.title}</span>
                            <span class="trending-count">${m.completion_count} views</span>
                        </li>
                    `).join('');
                }
            }

        } catch(e) { console.error(e); }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('input');
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: inputs[0].value, password: inputs[1].value })
        });
        const data = await res.json();
        if(data.success) window.location.href = data.redirect;
        else alert(data.error);
    } catch(err) { alert("Error"); }
}

async function handleSignup(e) {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('input');
    const roleSelect = document.getElementById('roleSelect');
    try {
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: inputs[0].value, 
                email: inputs[1].value, 
                password: inputs[2].value, 
                role: roleSelect.value 
            })
        });
        const data = await res.json();
        if(data.success) {
            alert('Account created! Please login.');
            window.location.href = 'login.html';
        } else { alert(data.error); }
    } catch(err) { alert("Error"); }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = 'main.html';
    } catch (err) { window.location.href = 'main.html'; }
}

// AUTO INIT
checkAuthAndUI();