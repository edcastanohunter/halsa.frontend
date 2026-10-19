<#-- Copied from Keycloak 26.4 base/login/login-page-expired.ftl. Markup only: both links keep their ids and URLs. -->
<#import "template.ftl" as layout>
<@layout.registrationLayout; section>
    <#if section = "header">
        ${msg("pageExpiredTitle")}
    <#elseif section = "form">
        <p id="instruction1" class="hl-lead">${msg("halsaPageExpiredIntro")}</p>
        <div class="${properties.kcFormButtonsClass!}">
            <a id="loginContinueLink" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" href="${url.loginAction}">${msg("halsaPageExpiredContinue")}</a>
            <a id="loginRestartLink" class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" href="${url.loginRestartFlowUrl}">${msg("halsaPageExpiredRestart")}</a>
        </div>
    </#if>
</@layout.registrationLayout>
