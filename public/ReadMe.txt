MOVstrem – Your Own Cinema

MOVstrem is a front-end movie community web app that lets users discover popular films, browse by genre, manage their own watchlists, and interact with content through posts and events. It also includes a simple admin area for managing users, movies, events, posts, genres, restricted words, and audit logs.

Features

Public / User-facing pages

- Home / Landing page
  Hero section with call-to-action buttons for Admin and User dashboards.  
  Highlighted “Most Popular” movies with posters, year, rating, and genre.  
  “Choose The Type Of Film You Liked” section showing major categories (Action, Fantasy, Comedy, etc.).

- Profile page
  Simple profile form with fields like first name, last name, and email.  
  Styled inputs with focus effects and a save button for updating details.

- Movies page  
  Two-column layout: left side shows a clickable list of movies; right side shows dynamic movie details (title, synopsis, year).  
  Buttons to “Add to Watchlist” and “Add Review” for the selected movie.

- Friends page
  Friend list with avatars and a Remove button.  
  Pending friend requests with Accept and Decline actions.  
  “Add Friend” button that lets you create a simple new pending request.

- Posts page
  Community Posts hub with:
  - Create Post form (select related movie and write content).
  - User Posts view with sample content, Like and Back buttons.  
  Sections are shown/hidden with basic JavaScript.

- Events page (user)  
  List of upcoming events and a detail view for a selected event with a back button.

- Other page
  Notifications, History, and Watchlist sections for the user.  
  Simple lists showing recent notifications, viewed movies, and items to watch.

- User dashboard 
  Welcome block with greeting and descriptive text.  
  Recent activity list showing what the user has recently watched or posted.

### Admin pages

All admin pages share the same dark nav bar and layout style and are linked from the landing page Admin button.

- Admin Dashboard
  Summary stats (users, reviews, reported posts).  
  Recent moderation activity.  
  Highlight banner reminding admins to handle flagged content.

- Manage Users
  Table of users with columns for name and email.  
  Actions: View and Delete.

- Manage Movies
  Section with grouped buttons to Add, Edit, and Delete movies.

- Manage Posts 
  Moderation tools section describing controls for post management.

- Manage Events 
  Event tools area with buttons to Create New Event and Monitor Events.

- Manage Genres 
  Styled list of genres (Action, Comedy, Drama, etc.) with custom bullets.

- Restricted Words 
  List of words that are not allowed in posts/comments.  
  Intended for content moderation and filtering.

- Audit Logs
  Table listing admin actions (who did what, and the target).



## Tech stack

- HTML5 for structure.  
- CSS3 (shared `style.css` plus page-specific styles) for layout and styling.  
- JavaScript (inline) for simple dynamic behaviors:
  - Switching movie details.
  - Toggling create/view post sections.
  - Managing friend and pending-request lists.
  - Showing and hiding event details.

Currently there is no backend or database; all data (movies, users, posts, events, etc.) is hard-coded for demonstration.