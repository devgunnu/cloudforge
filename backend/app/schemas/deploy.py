from pydantic import BaseModel


class DeployRollbackRequest(BaseModel):
    deployment_id: str
