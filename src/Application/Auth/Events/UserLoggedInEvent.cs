namespace Microsoft.Extensions.DependencyInjection.Auth.Events;

public record UserLoggedInEvent(
    string Email,
    DateTime TimeStamp,
    string IpAddress,
    string Location,
    string DeviceInfo);
