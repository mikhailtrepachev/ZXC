using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Infrastructure.Services;

/// <summary>
/// Email sender class for sending emails (for registration for ex.)
/// </summary>
public class EmailSender : IEmailSender
{
    /// <summary>
    /// Seq logger
    /// </summary>
    private readonly ILogger<EmailSender> _logger;
    
    /// <summary>
    /// Configuration for connecting to smtp host
    /// </summary>
    private readonly IConfiguration _configuration;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="logger">Seq  logger</param>
    /// <param name="configuration">Configuration for connecting to smtp host</param>
    public EmailSender(ILogger<EmailSender> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    /// <summary>
    /// Will send an email using SMTP 
    /// </summary>
    /// <param name="email">Email address to send</param>
    /// <param name="subject">Subject of email</param>
    /// <param name="message">HTML body of message</param>
    /// <param name="cancellationToken">Cancellation token</param>
    public async Task SendEmailAsync(string email, string subject, string message,
        CancellationToken cancellationToken = default)
    {
        try
        {
            MimeMessage emailMsg = new MimeMessage();

            string fromAddress = _configuration["SmtpSettings:From"]!;

            emailMsg.From.Add(new MailboxAddress("ZxcBank", fromAddress));

            emailMsg.To.Add(MailboxAddress.Parse(email));
            emailMsg.Subject = subject;

            BodyBuilder builder = new BodyBuilder { HtmlBody = message };
            emailMsg.Body = builder.ToMessageBody();

            using SmtpClient smtp = new SmtpClient();

            string host = _configuration["SmtpSettings:Host"]!;
            int port = int.Parse(_configuration["SmtpSettings:Port"]!);

            await smtp.ConnectAsync(host, port, SecureSocketOptions.StartTls, cancellationToken);

            string user = _configuration["SmtpSettings:Username"]!;
            string password = _configuration["SmtpSettings:Password"]!;

            await smtp.AuthenticateAsync(user, password, cancellationToken);

            await smtp.SendAsync(emailMsg, cancellationToken);
            await smtp.DisconnectAsync(true, cancellationToken);

            _logger.LogInformation("Email sent successfully to {ToEmail}", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {ToEmail}", email);
        }
    }
}
