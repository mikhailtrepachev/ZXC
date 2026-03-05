namespace ZxcBank.Application.UserSessions.Queries.GetUserSessions;

public class UserSessionDto
{
    public int Id { get; init; }
    public string DeviceInfo { get; init; } = string.Empty;
    public string IpAddress { get; init; } = string.Empty;
    public string Location { get; init; } = string.Empty;
    public DateTimeOffset Created { get; init; } 
}
