using MassTransit;
using ZxcBank.Application.Auth.Events;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Infrastructure.Consumers;

public class UserRegisteredConsumer : IConsumer<UserRegisteredEvent>
{
    private readonly IEmailSender _emailSender;

    public UserRegisteredConsumer(IEmailSender emailSender)
    {
        _emailSender = emailSender;
    }

    public async Task Consume(ConsumeContext<UserRegisteredEvent> context)
    {
        UserRegisteredEvent message = context.Message;
        
        string htmlBody = $@"
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <h2 style='color: #2c3e50;'>Vítejte v ZxcBank!</h2>
                <p>Děkujeme za registraci. Abyste mohli začít využívat služby banky, potvrďte prosím svůj email.</p>
                <a href='{message.ConfirmationLink}' 
                   style='display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px;'>
                   Potvrdit email
                </a>
            </div>";

        string theme = "Potvrzení registrace u ZxcBank";
        
        await _emailSender.SendEmailAsync(message.Email, theme, htmlBody, context.CancellationToken);
    }
}
