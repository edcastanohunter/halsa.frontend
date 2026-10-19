<#-- Copied from Keycloak 26.4 base/login/login-verify-email.ftl. Markup only: the resend link and `cancel-aia` are unchanged. -->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=true; section>
    <#if section = "header">
        ${msg("emailVerifyTitle")}
    <#elseif section = "form">
        <div class="hl-state-icon hl-state-info" aria-hidden="true"><span class="hl-icon hl-icon-mail"></span></div>
        <p class="hl-lead">
            <#if verifyEmail??>
                ${msg("emailVerifyInstruction1",verifyEmail)}
            <#else>
                ${msg("emailVerifyInstruction4",user.email)}
            </#if>
        </p>
        <#if isAppInitiatedAction??>
            <form id="kc-verify-email-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
                <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                    <#if verifyEmail??>
                        <input class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("emailVerifyResend")}" />
                    <#else>
                        <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("emailVerifySend")}" />
                    </#if>
                    <button class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" name="cancel-aia" value="true" formnovalidate>${msg("doCancel")}</button>
                </div>
            </form>
        </#if>
    <#elseif section = "info">
        <#if !isAppInitiatedAction??>
            <p class="hl-hint">
                ${msg("emailVerifyInstruction2")}
                <a class="hl-link" href="${url.loginAction}">${msg("halsaResendEmail")}</a>
            </p>
        </#if>
    </#if>
</@layout.registrationLayout>
