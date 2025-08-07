import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// --- Dark mode hook ---
const useDarkMode = () => {
  const [dark, setDark] = useState(() =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
};

interface TrainingVideo {
  title: string;
  description: string;
  url: string;
  category: string;
  duration?: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

const VimeoTraining: React.FC = () => {
  const darkMode = useDarkMode();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');

  const palette = darkMode
    ? {
        bg: '#181a20',
        card: '#23262f',
        border: '#33384a',
        text: '#e6e6e6',
        textSecondary: '#b0b0b0',
        accent: '#1976d2',
        accent2: '#28a745',
        accent3: '#e53935',
        accent4: '#d81b60',
        accent5: '#2d3a4a',
        inputBg: '#23262f',
        inputText: '#e6e6e6',
        inputBorder: '#33384a',
        shadow: '0 2px 12px #0008',
        modalBg: '#23262f',
        modalBorder: '#33384a',
      }
    : {
        bg: '#f7faff',
        card: '#fff',
        border: '#eee',
        text: '#222',
        textSecondary: '#888',
        accent: '#1976d2',
        accent2: '#28a745',
        accent3: '#e53935',
        accent4: '#d81b60',
        accent5: '#e3f2fd',
        inputBg: '#fff',
        inputText: '#222',
        inputBorder: '#ccc',
        shadow: '0 2px 8px #0001',
        modalBg: '#fff',
        modalBorder: '#eee',
      };

  const trainingVideos: TrainingVideo[] = [
    {
      title: "Get to Know the New Vimeo",
      description: "Basic overview of Vimeo's platform and core features. Perfect starting point for new users.",
      url: "https://vimeo.com/watch-demo",
      category: "Getting Started",
      level: "Beginner"
    },
    {
      title: "Mastering Enterprise Video: The Path to a Unified Strategy",
      description: "Learn how to implement strategic video platform across organizations. Covers Vimeo's State of Video at Work report findings.",
      url: "https://vimeo.com/events/path-to-unified-enterprise-video-strategy",
      category: "Enterprise",
      level: "Intermediate"
    },
    {
      title: "Vimeo Spotlight: Winter 2024 Product Release",
      description: "Overview of new features including Vimeo Central (AI-powered video hub). Shows latest enterprise capabilities.",
      url: "https://vimeo.com/events/whats-new-at-vimeo-winter-2024-amer",
      category: "Product Updates",
      level: "Intermediate"
    },
    {
      title: "5 Ways to Use Video for Internal Communications",
      description: "Team communication strategies and user management features. Perfect for understanding collaboration tools.",
      url: "https://vimeo.com/events/video-for-internal-comms-webinar-amer",
      category: "Team Management",
      level: "Intermediate"
    },
    {
      title: "The Future of Learning with AI and Video",
      description: "For HR and L&D leaders. Shows training strategies with AI and video technology.",
      url: "https://vimeo.com/events/the-future-of-learning-with-ai-and-video",
      category: "AI & Learning",
      level: "Advanced"
    },
    {
      title: "Maximize L&D Impact with Video: A Data-Driven Approach",
      description: "Transform learning strategy using video. Covers analytics and reporting capabilities.",
      url: "https://vimeo.com/events/maximize-learning-development-with-video",
      category: "Analytics",
      level: "Advanced"
    },
    {
      title: "Vimeo AI Translation in Action: A Live Demo",
      description: "Live demonstration of Vimeo's AI-powered video translation tool for expanding audience reach.",
      url: "https://vimeo.com/events/ai-translation-in-action-live-demo",
      category: "AI & Learning",
      level: "Intermediate"
    },
    {
      title: "Spring Release Webinar",
      description: "Demo of newest products and innovations. Shows how they unlock video power in organizations.",
      url: "https://vimeo.com/events/spring-release-webinar",
      category: "Product Updates",
      level: "Beginner"
    },
    {
      title: "The Secret to Supercharging Employee Engagement",
      description: "Communication and knowledge sharing in workplace. Relevant for user engagement strategies.",
      url: "https://vimeo.com/events/supercharging-employee-engagement",
      category: "Team Management",
      level: "Intermediate"
    },
    {
      title: "AI in Video",
      description: "Learn how AI can improve your video marketing and communication strategy for better business outcomes.",
      url: "https://vimeo.com/events/ai-webinar-amer",
      category: "AI & Learning",
      level: "Advanced"
    },
    {
      title: "Don't Lose Great Meetings",
      description: "Learn about Vimeo x Microsoft Teams integration for organizing and hosting recorded meetings.",
      url: "https://vimeo.com/events/microsoft-teams-webinar",
      category: "Integrations",
      level: "Intermediate"
    },
    {
      title: "Streamlining Workflows with Sales Cloud",
      description: "Learn how Vimeo's Sales Cloud integration helps organizations drive efficiencies and improve Marketing ROI.",
      url: "https://vimeo.com/events/sales-cloud-webinar",
      category: "Integrations",
      level: "Advanced"
    }
  ];

  const categories = ['All', ...Array.from(new Set(trainingVideos.map(video => video.category)))];
  const levels = ['All', 'Beginner', 'Intermediate', 'Advanced'];

  const filteredVideos = trainingVideos.filter(video => {
    const categoryMatch = selectedCategory === 'All' || video.category === selectedCategory;
    const levelMatch = selectedLevel === 'All' || video.level === selectedLevel;
    return categoryMatch && levelMatch;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner': return palette.accent2;
      case 'Intermediate': return palette.accent;
      case 'Advanced': return palette.accent3;
      default: return palette.textSecondary;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Getting Started': return '🚀';
      case 'Enterprise': return '🏢';
      case 'Product Updates': return '🆕';
      case 'Team Management': return '👥';
      case 'AI & Learning': return '🤖';
      case 'Analytics': return '📊';
      case 'Integrations': return '🔗';
      default: return '📹';
    }
  };

  return (
    <div style={{ 
      backgroundColor: palette.bg, 
      color: palette.text, 
      minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Simple Header for Training Page */}
      <header style={{
        backgroundColor: palette.card,
        borderBottom: `1px solid ${palette.border}`,
        padding: '1rem 2rem',
        boxShadow: palette.shadow
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <h2 style={{ 
            margin: 0, 
            color: palette.accent,
            fontSize: '1.5rem',
            fontWeight: '600'
          }}>
            📹 Screen Recorder
          </h2>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: palette.accent,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = palette.accent4;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = palette.accent;
            }}
          >
            Back to Login
          </button>
        </div>
      </header>
      
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '700', 
            margin: '0 0 1rem 0',
            background: `linear-gradient(135deg, ${palette.accent}, ${palette.accent4})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Vimeo Enterprise Training
          </h1>
          <p style={{ 
            fontSize: '1.2rem', 
            color: palette.textSecondary, 
            maxWidth: '600px', 
            margin: '0 auto',
            lineHeight: '1.6'
          }}>
            Learn how to leverage Vimeo's enterprise features for your screen recording and video management needs.
          </p>
        </div>

        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '2rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontWeight: '500' }}>Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: `1px solid ${palette.inputBorder}`,
                backgroundColor: palette.inputBg,
                color: palette.inputText,
                fontSize: '0.9rem'
              }}
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontWeight: '500' }}>Level:</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: `1px solid ${palette.inputBorder}`,
                backgroundColor: palette.inputBg,
                color: palette.inputText,
                fontSize: '0.9rem'
              }}
            >
              {levels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <div style={{ 
            marginLeft: 'auto', 
            color: palette.textSecondary,
            fontSize: '0.9rem'
          }}>
            {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Learning Path Recommendation */}
        <div style={{
          backgroundColor: palette.card,
          border: `1px solid ${palette.border}`,
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: palette.shadow
        }}>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            color: palette.accent,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🎯 Recommended Learning Path
          </h3>
          <div style={{ color: palette.textSecondary, lineHeight: '1.6' }}>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>1. Start with:</strong> "Get to Know the New Vimeo" for basic overview
            </p>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>2. Then watch:</strong> "Mastering Enterprise Video" for strategic understanding
            </p>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>3. Follow with:</strong> "Winter 2024 Product Release" for latest features
            </p>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>4. Focus on:</strong> "5 Ways to Use Video for Internal Communications" for team management
            </p>
            <p style={{ margin: '0' }}>
              <strong>5. Explore:</strong> AI and Analytics webinars for advanced features
            </p>
          </div>
        </div>

        {/* Video Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {filteredVideos.map((video, index) => (
            <div
              key={index}
              style={{
                backgroundColor: palette.card,
                border: `1px solid ${palette.border}`,
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: palette.shadow,
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = darkMode 
                  ? '0 4px 20px #0001' 
                  : '0 4px 16px #0002';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = palette.shadow;
              }}
              onClick={() => window.open(video.url, '_blank')}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>{getCategoryIcon(video.category)}</span>
                  <span style={{ 
                    fontSize: '0.8rem', 
                    color: palette.textSecondary,
                    fontWeight: '500'
                  }}>
                    {video.category}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  color: getLevelColor(video.level),
                  backgroundColor: `${getLevelColor(video.level)}20`,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '12px',
                  fontWeight: '500'
                }}>
                  {video.level}
                </span>
              </div>

              <h3 style={{ 
                margin: '0 0 0.75rem 0', 
                fontSize: '1.1rem',
                fontWeight: '600',
                lineHeight: '1.3',
                color: palette.text
              }}>
                {video.title}
              </h3>

              <p style={{ 
                margin: '0 0 1rem 0', 
                color: palette.textSecondary, 
                fontSize: '0.9rem',
                lineHeight: '1.5'
              }}>
                {video.description}
              </p>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginTop: 'auto'
              }}>
                <button
                  style={{
                    backgroundColor: palette.accent,
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = palette.accent4;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = palette.accent;
                  }}
                >
                  Watch Now →
                </button>
                
                {video.duration && (
                  <span style={{ 
                    color: palette.textSecondary, 
                    fontSize: '0.8rem',
                    fontWeight: '500'
                  }}>
                    {video.duration}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredVideos.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: palette.textSecondary
          }}>
            <h3>No videos found</h3>
            <p>Try adjusting your filters to see more training videos.</p>
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{
          backgroundColor: palette.card,
          border: `1px solid ${palette.border}`,
          borderRadius: '12px',
          padding: '2rem',
          marginTop: '3rem',
          textAlign: 'center',
          boxShadow: palette.shadow
        }}>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            color: palette.accent
          }}>
            Ready to Get Started with Vimeo?
          </h3>
          <p style={{ 
            color: palette.textSecondary, 
            marginBottom: '1.5rem',
            lineHeight: '1.6'
          }}>
            Contact Vimeo's enterprise team for a custom demo and to discuss how their platform 
            can enhance your screen recording and video management workflow.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.open('https://vimeo.com/enterprise/request-demo', '_blank')}
              style={{
                backgroundColor: palette.accent,
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = palette.accent4;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = palette.accent;
              }}
            >
              Request Enterprise Demo
            </button>
            <button
              onClick={() => window.open('https://vimeo.com/upgrade', '_blank')}
              style={{
                backgroundColor: 'transparent',
                color: palette.accent,
                border: `2px solid ${palette.accent}`,
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = palette.accent;
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = palette.accent;
              }}
            >
              View Pricing Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VimeoTraining;
