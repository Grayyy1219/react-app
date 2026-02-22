import React, { useState } from 'react';
import { getDatabase, ref, push, set } from "firebase/database";
import { app } from './firebase.js'; 

function PostCreator() {
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const db = getDatabase(app); 
    const postsListRef = ref(db, 'posts'); 

    
    const newPostRef = push(postsListRef);

    try {
      
      await set(newPostRef, {
        title: postTitle,
        content: postContent,
        timestamp: new Date().toISOString() 
        
      });
      alert('Post added successfully!');
      setPostContent('');
      setPostTitle('');
    } catch (error) {
      console.error('Error adding post:', error);
      alert('Failed to add post.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create a New Post</h2>
      <div>
        <label>Title:</label>
        <input
          type="text"
          value={postTitle}
          onChange={(e) => setPostTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label>Content:</label>
        <textarea
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
          required
        ></textarea>
      </div>
      <button type="submit">Add Post</button>
    </form>
  );
}

export default PostCreator;
