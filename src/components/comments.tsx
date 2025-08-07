import React, { useEffect, useState } from 'react';
import { supabase } from '../auth/supabaseClient';
import type { Comment } from '../types/comment';

interface CommentsProps {
  recordingId: string;
  userId: string;
}

const Comments: React.FC<CommentsProps> = ({ recordingId, userId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('recording_id', recordingId)
        .order('created_at', { ascending: true });
      setComments(data || []);
    };
    fetchComments();
  }, [recordingId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .insert([{ recording_id: recordingId, user_id: userId, content: newComment }])
      .select();
    if (!error && data) setComments([...comments, ...data]);
    setNewComment('');
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Comments</div>
      <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
        {comments.map(c => (
          <div key={c.id} style={{ marginBottom: 6, fontSize: 14 }}>
            <span style={{ color: '#888', fontSize: 12 }}>{new Date(c.created_at).toLocaleString()}:</span>
            <br />
            {c.content}
          </div>
        ))}
        {comments.length === 0 && <div style={{ color: '#888', fontSize: 13 }}>No comments yet.</div>}
      </div>
      <form onSubmit={handleAddComment} style={{ display: 'flex', gap: 6 }}>
        <input
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          style={{ flex: 1, fontSize: 14, padding: 4 }}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !newComment.trim()} style={{ fontSize: 14 }}>
          Post
        </button>
      </form>
    </div>
  );
};

export default Comments;