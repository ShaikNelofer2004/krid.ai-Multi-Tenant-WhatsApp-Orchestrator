from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str
    MONGODB_DB_NAME: str = "whatsapp_saas"

    # Google Gemini
    GOOGLE_API_KEY: str
    GOOGLE_API_KEY_FALLBACK_1: str = ""   # First fallback key (used if primary hits quota)
    GOOGLE_API_KEY_FALLBACK_2: str = ""   # Second fallback key
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Groq ( for AI message generation)
    GROQ_API_KEY: str = ""

    # Twilio (Sandbox configuration)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_NUMBER: str = "whatsapp:+14155238886"
    # Secondary Twilio account (optional — for multi-account setups)
    TWILIO_ACCOUNT_SID_2: str = ""
    TWILIO_AUTH_TOKEN_2: str = ""

    @property
    def all_twilio_credentials(self) -> list[tuple[str, str]]:
        """Returns all configured (account_sid, auth_token) pairs."""
        pairs = []
        if self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN:
            pairs.append((self.TWILIO_ACCOUNT_SID, self.TWILIO_AUTH_TOKEN))
        if self.TWILIO_ACCOUNT_SID_2 and self.TWILIO_AUTH_TOKEN_2:
            pairs.append((self.TWILIO_ACCOUNT_SID_2, self.TWILIO_AUTH_TOKEN_2))
        return pairs

    def twilio_auth_for_url(self, url: str) -> tuple[str, str] | None:
        """
        Extract the Account SID embedded in a Twilio media URL and return
        the matching (sid, token) credentials pair, or the first available pair.

        Twilio media URLs have the form:
          https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/.../Media/...
        Note: Twilio SIDs contain lowercase hex digits (e.g. AC893cd4...) so
        the regex must use [A-Za-z0-9], NOT [A-Z0-9].
        """
        import re
        m = re.search(r'/Accounts/([A-Za-z0-9]{34})/', url)
        url_sid = m.group(1) if m else None

        all_creds = self.all_twilio_credentials
        if url_sid:
            for sid, token in all_creds:
                if sid.lower() == url_sid.lower():  # case-insensitive match
                    return (sid, token)
        # Fallback: return first configured pair
        return all_creds[0] if all_creds else None


    @property
    def all_gemini_keys(self) -> list[str]:
        """Returns all configured Gemini API keys, primary first."""
        return [
            k for k in [
                self.GOOGLE_API_KEY,
                self.GOOGLE_API_KEY_FALLBACK_1,
                self.GOOGLE_API_KEY_FALLBACK_2,
            ] if k
        ]

    # WhatsApp / Meta
    WHATSAPP_TOKEN: str
    WHATSAPP_PHONE_NUMBER_ID: str
    WHATSAPP_VERIFY_TOKEN: str
    WHATSAPP_APP_SECRET: str = ""  # For Bonus: X-Hub-Signature-256 validation

    # App
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
