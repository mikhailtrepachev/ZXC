namespace ZxcBank.Application.Notifications.Events;

public record class SuspiciousActivityDetectedEvent(
    string UserId,
    string Email,
    string NewLocation,
    string NewIpAddress,
    string OldLocation);
