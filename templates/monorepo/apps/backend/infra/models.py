from sqlalchemy import Boolean, CheckConstraint, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Task(Base):
    __tablename__ = 'tasks'
    __table_args__ = (CheckConstraint('length(trim(title)) > 0', name='task_title_not_blank'),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(nullable=False)
    completed: Mapped[bool] = mapped_column(
        Boolean(create_constraint=True, name='task_completed_bool'), nullable=False)
