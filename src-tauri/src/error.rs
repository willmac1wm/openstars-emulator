use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum DesktopError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl Serialize for DesktopError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type DesktopResult<T> = Result<T, DesktopError>;

impl DesktopError {
    pub fn msg(s: impl Into<String>) -> Self {
        Self::Message(s.into())
    }
}
