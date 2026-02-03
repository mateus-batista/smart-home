"""Tests for conversation history management."""

import time

import pytest

from belle.conversation import (
    Message,
    ConversationSession,
    ConversationManager,
    get_conversation_manager,
)


class TestMessage:
    """Tests for Message dataclass."""

    def test_message_creation(self):
        """Should create message with role and content."""
        msg = Message(role="user", content="Hello")
        assert msg.role == "user"
        assert msg.content == "Hello"
        assert msg.timestamp > 0

    def test_message_with_custom_timestamp(self):
        """Should accept custom timestamp."""
        msg = Message(role="assistant", content="Hi", timestamp=12345.0)
        assert msg.timestamp == 12345.0


class TestConversationSession:
    """Tests for ConversationSession."""

    def test_new_session_empty(self):
        """New session should have empty history."""
        session = ConversationSession(session_id="test-1")
        assert len(session.messages) == 0
        assert session.get_history() == []

    def test_add_message(self):
        """Should add messages to history."""
        session = ConversationSession(session_id="test-1")
        session.add_message("user", "Hello")
        session.add_message("assistant", "Hi there!")

        history = session.get_history()
        assert len(history) == 2
        assert history[0] == {"role": "user", "content": "Hello"}
        assert history[1] == {"role": "assistant", "content": "Hi there!"}

    def test_add_exchange(self):
        """Should add user/assistant pairs."""
        session = ConversationSession(session_id="test-1")
        session.add_exchange("What time is it?", "It's 3 PM.")

        history = session.get_history()
        assert len(history) == 2
        assert history[0]["role"] == "user"
        assert history[1]["role"] == "assistant"

    def test_history_trimming(self):
        """Should trim old messages when over limit."""
        session = ConversationSession(session_id="test-1", max_history=4)

        # Add 3 exchanges (6 messages)
        session.add_exchange("Q1", "A1")
        session.add_exchange("Q2", "A2")
        session.add_exchange("Q3", "A3")

        # Should only keep last 4 messages
        history = session.get_history()
        assert len(history) == 4
        assert history[0]["content"] == "Q2"  # Q1/A1 trimmed
        assert history[3]["content"] == "A3"

    def test_clear_history(self):
        """Should clear all messages."""
        session = ConversationSession(session_id="test-1")
        session.add_exchange("Q", "A")
        session.clear()

        assert len(session.messages) == 0
        assert session.get_history() == []

    def test_session_expiry(self):
        """Should detect expired sessions."""
        session = ConversationSession(session_id="test-1")
        assert session.is_expired(ttl=1000) is False

        # Manually set old timestamp
        session.last_activity = time.time() - 100
        assert session.is_expired(ttl=50) is True
        assert session.is_expired(ttl=200) is False

    def test_activity_updates_timestamp(self):
        """Adding messages should update last_activity."""
        session = ConversationSession(session_id="test-1")
        old_activity = session.last_activity

        time.sleep(0.01)
        session.add_message("user", "test")

        assert session.last_activity > old_activity


class TestConversationManager:
    """Tests for ConversationManager."""

    def test_get_creates_session(self):
        """Should create new session if not exists."""
        manager = ConversationManager()
        session = manager.get_session("new-session")

        assert session.session_id == "new-session"
        assert len(session.messages) == 0

    def test_get_returns_existing_session(self):
        """Should return existing session."""
        manager = ConversationManager()
        session1 = manager.get_session("session-1")
        session1.add_message("user", "Hello")

        session2 = manager.get_session("session-1")
        assert len(session2.messages) == 1
        assert session1 is session2

    def test_get_history(self):
        """Should get history for session."""
        manager = ConversationManager()
        manager.add_exchange("session-1", "Q", "A")

        history = manager.get_history("session-1")
        assert len(history) == 2

    def test_add_exchange(self):
        """Should add exchange to session."""
        manager = ConversationManager()
        manager.add_exchange("session-1", "Question", "Answer")

        session = manager.get_session("session-1")
        assert len(session.messages) == 2

    def test_clear_session(self):
        """Should clear specific session."""
        manager = ConversationManager()
        manager.add_exchange("session-1", "Q", "A")
        manager.clear_session("session-1")

        history = manager.get_history("session-1")
        assert len(history) == 0

    def test_remove_session(self):
        """Should remove session entirely."""
        manager = ConversationManager()
        manager.add_exchange("session-1", "Q", "A")
        manager.remove_session("session-1")

        # Getting session should create new empty one
        history = manager.get_history("session-1")
        assert len(history) == 0

    def test_expired_sessions_cleaned(self):
        """Should clean up expired sessions."""
        manager = ConversationManager(session_ttl=0.05)  # 50ms TTL

        # Create session and let it expire
        manager.add_exchange("old-session", "Q", "A")
        time.sleep(0.1)

        # Access triggers cleanup
        manager.get_session("new-session")

        # Old session should be gone
        assert "old-session" not in manager._sessions

    def test_get_stats(self):
        """Should return manager statistics."""
        manager = ConversationManager()
        manager.add_exchange("session-1", "Q1", "A1")
        manager.add_exchange("session-2", "Q2", "A2")

        stats = manager.get_stats()
        assert stats["active_sessions"] == 2
        assert "session-1" in stats["sessions"]
        assert stats["sessions"]["session-1"]["message_count"] == 2

    def test_multiple_sessions_isolated(self):
        """Sessions should be isolated from each other."""
        manager = ConversationManager()
        manager.add_exchange("session-1", "Q1", "A1")
        manager.add_exchange("session-2", "Q2", "A2")

        history1 = manager.get_history("session-1")
        history2 = manager.get_history("session-2")

        assert history1[0]["content"] == "Q1"
        assert history2[0]["content"] == "Q2"


class TestGlobalManager:
    """Tests for global conversation manager."""

    def test_get_global_manager(self):
        """Should return singleton manager."""
        manager1 = get_conversation_manager()
        manager2 = get_conversation_manager()
        assert manager1 is manager2
