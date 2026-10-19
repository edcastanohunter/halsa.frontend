<#-- Copied from Keycloak 26.4 base/login/terms.ftl. Markup only: `accept` and `cancel` are unchanged. -->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        ${msg("termsTitle")}
    <#elseif section = "form">
    <div id="kc-terms-text" class="hl-prose">
        ${kcSanitize(msg("termsText"))?no_esc}
    </div>
    <form class="${properties.kcFormClass!}" action="${url.loginAction}" method="POST">
        <div class="${properties.kcFormButtonsClass!}">
            <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" name="accept" id="kc-accept" type="submit" value="${msg("doAccept")}"/>
            <input class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" name="cancel" id="kc-decline" type="submit" value="${msg("doDecline")}"/>
        </div>
    </form>
    </#if>
</@layout.registrationLayout>
