from app.providers.base import CloudProvider
from app.providers.aws import AWSProvider

_PROVIDERS = {
    "aws": AWSProvider,
}


def get_provider(provider_type: str, credentials: dict) -> CloudProvider:
    cls = _PROVIDERS.get(provider_type.lower())
    if cls is None:
        raise ValueError(f"Unsupported cloud provider: {provider_type}")
    return cls.from_credentials(credentials)
