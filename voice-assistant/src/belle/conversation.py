"""Conversation history management for multi-turn interactions."""

import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# Default settings
DEFAULT_MAX_HISTORY = 10  # Max messages to keep per session
DEFAULT_SESSION_TTL = 300.0  # 5 minutes of inactivity


@dataclass
class Message:
    """A single message in a conversation."""

    role: str  # "user" or "assistant"
    content: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class ConversationSession:
    """A conversation session with history."""

    session_id: str
    messages: list[Message] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    max_history: int = DEFAULT_MAX_HISTORY

    def add_message(self, role: str, content: str) -> None:
        """Add a message to the conversation history."""
        self.messages.append(Message(role=role, content=content))
        self.last_activity = time.time()

        # Trim old messages if over limit (keep recent ones)
        if len(self.messages) > self.max_history:
            self.messages = self.messages[-self.max_history:]

    def add_exchange(self, user_message: str, assistant_response: str) -> None:
        """Add a user message and assistant response pair."""
        self.add_message("user", user_message)
        self.add_message("assistant", assistant_response)

    def get_history(self) -> list[dict[str, str]]:
        """Get conversation history in format expected by LLM."""
        return [{"role": m.role, "content": m.content} for m in self.messages]

    def clear(self) -> None:
        """Clear conversation history."""
        self.messages.clear()
        self.last_activity = time.time()

    def is_expired(self, ttl: float = DEFAULT_SESSION_TTL) -> bool:
        """Check if session has expired due to inactivity."""
        return (time.time() - self.last_activity) > ttl


class ConversationManager:
    """
    Manages conversation sessions for multi-turn interactions.

    Supports multiple concurrent sessions (e.g., different WebSocket connections).
    Sessions expire after a period of inactivity.
    """

    def __init__(
        self,
        max_history: int = DEFAULT_MAX_HISTORY,
        session_ttl: float = DEFAULT_SESSION_TTL,
    ):
        """
        Args:
            max_history: Maximum messages to keep per session
            session_ttl: Session timeout in seconds
        """
        self.max_history = max_history
        self.session_ttl = session_ttl
        self._sessions: dict[str, ConversationSession] = {}

    def get_session(self, session_id: str) -> ConversationSession:
        """
        Get or create a conversation session.

        Args:
            session_id: Unique session identifier

        Returns:
            ConversationSession for the given ID
        """
        self._cleanup_expired()

        if session_id not in self._sessions:
            self._sessions[session_id] = ConversationSession(
                session_id=session_id,
                max_history=self.max_history,
            )
            logger.debug(f"Created new conversation session: {session_id}")

        return self._sessions[session_id]

    def get_history(self, session_id: str) -> list[dict[str, str]]:
        """Get conversation history for a session."""
        session = self.get_session(session_id)
        return session.get_history()

    def add_exchange(
        self,
        session_id: str,
        user_message: str,
        assistant_response: str,
    ) -> None:
        """Add a user/assistant exchange to session history."""
        session = self.get_session(session_id)
        session.add_exchange(user_message, assistant_response)
        logger.debug(
            f"Session {session_id}: Added exchange, "
            f"history now has {len(session.messages)} messages"
        )

    def clear_session(self, session_id: str) -> None:
        """Clear history for a specific session."""
        if session_id in self._sessions:
            self._sessions[session_id].clear()
            logger.debug(f"Cleared conversation session: {session_id}")

    def remove_session(self, session_id: str) -> None:
        """Remove a session entirely."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            logger.debug(f"Removed conversation session: {session_id}")

    def _cleanup_expired(self) -> None:
        """Remove expired sessions."""
        expired = [
            sid for sid, session in self._sessions.items()
            if session.is_expired(self.session_ttl)
        ]
        for sid in expired:
            del self._sessions[sid]
            logger.debug(f"Expired conversation session: {sid}")

    def get_stats(self) -> dict[str, Any]:
        """Get manager statistics."""
        self._cleanup_expired()
        return {
            "active_sessions": len(self._sessions),
            "sessions": {
                sid: {
                    "message_count": len(session.messages),
                    "age_seconds": time.time() - session.created_at,
                    "idle_seconds": time.time() - session.last_activity,
                }
                for sid, session in self._sessions.items()
            },
        }


# Global conversation manager instance
_conversation_manager: ConversationManager | None = None


def get_conversation_manager() -> ConversationManager:
    """Get the global conversation manager instance."""
    global _conversation_manager
    if _conversation_manager is None:
        _conversation_manager = ConversationManager()
    return _conversation_manager
