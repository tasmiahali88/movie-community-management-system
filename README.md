🎬 Movie Community Management System

A database-driven social platform for movie enthusiasts — built as part of CS2005: Database Systems (Fall 2025) at FAST-NUCES, Islamabad.


📖 About

The Movie Community Management System is a full-stack web application that blends movie exploration with social interaction. Users can discover movies, maintain watchlists, write reviews, join discussions, host watch parties, and chat with friends — all in one place.


✨ Features

👤 User Management


Account registration and login with secure authentication
Personal profile displaying watchlist, reviews, posts, events, and friends
Friend requests with pending/accepted/declined status
Separate admin dashboard for system management


🎥 Movies


Browse a movie catalog with title, synopsis, genres, release year, and poster
Movies can belong to multiple genres
Admins can add, update, or remove movie and genre records


📋 Watchlist, History & Reviews


Add movies to a personal watchlist with statuses: to-watch, watching, completed
View watch history with timestamps
Write reviews and rate movies on a scale of 1–10
Real-time average ratings and review counts per movie


💬 Discussions & Posts


Per-movie discussion forums for community interaction
Like and comment on posts
Notifications for likes, comments, and friend requests
Admin moderation of posts and comments


🎉 Watch Parties


Host watch party events linked to specific movies
Join available events (no overlapping events allowed)
Completed events automatically update participants' watch history


🔒 Private Chats


One-to-one messaging between confirmed friends
Messages store sender, receiver, content, timestamp, and read status


📊 Recommendations & Trending


Top 10 highest-rated movie recommendations per user
Top 10 most-watched/trending movies by view count


🛡️ Admin Tools


Restricted word list management and content moderation
Analytical reports: most-watched movies, highest-rated, most active users, most popular forums
Full audit trail logging all admin actions



🛠️ Tech Stack

LayerTechnologyFrontendHTML, CSSBackendNode.js, Express.jsDatabaseMySQLAuthenticationexpress-session, bcryptjsERD Tooldraw.io / LucidChart


🗂️ Project Structure

movie-community-management-system/
│
├── public/                  # Frontend HTML/CSS pages
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── main.html
│   ├── movies.html
│   ├── profile.html
│   ├── friends.html
│   ├── events.html
│   ├── post.html
│   ├── admin.html
│   ├── style.css
│   └── js/
│       └── main.js
│
├── Iteration 1/             # ERD and SQL schema (Iteration 1 submission)
│
├── server.js                # Main Node.js/Express server
├── db.js                    # MySQL database connection
├── final.sql                # Complete SQL schema
├── sample_data.sql          # Sample data for testing
├── package.json
└── .gitignore


⚙️ Setup & Installation

Prerequisites


Node.js installed
MySQL installed and running


Steps


Clone the repository


bash   git clone https://github.com/tasmiahali88/movie-community-management-system.git
   cd movie-community-management-system


Install dependencies


bash   npm install


Set up the database

Open MySQL and create a database





sql   CREATE DATABASE movie_community;


Import the schema


bash   mysql -u root -p movie_community < final.sql


Import sample data


bash   mysql -u root -p movie_community < sample_data.sql


Configure database credentials

Open db.js and update with your MySQL username and password



Run the server


bash   node server.js


Open in browser


   http://localhost:3000


🗃️ Database Concepts Used
Relational schema with primary and foreign keys
Joins and aggregate functions with grouping and filtering
Views for report generation
Stored procedures (e.g. updating average ratings after a new review)
Triggers for admin audit trail logging
Functions for movie recommendations
GRANT and REVOKE for user role privileges (Admin vs General User)





📅 Project Iterations

IterationDeliverableMarks1ERD + SQL Schema602Frontend + Sample Data503Complete System (Node.js + MySQL)140


⚠️ Note

This project was developed for academic purposes at National University of Computing and Emerging Sciences (FAST-NUCES), Islamabad as part of the CS2005 Database Systems course (Fall 2025).
