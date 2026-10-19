<#-- Copied from Keycloak 26.4 base/login/error.ftl. Markup only, with a friendly title and a "Volver al inicio" link. -->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        ${kcSanitize(msg("errorTitle"))?no_esc}
    <#elseif section = "form">
        <div id="kc-error-message">
            <div class="hl-state-icon hl-state-error" aria-hidden="true"><span class="hl-icon hl-icon-alert-triangle"></span></div>
            <p class="hl-lead">${kcSanitize(message.summary)?no_esc}</p>
            <#if skipLink??>
            <#else>
                <#if client?? && client.baseUrl?has_content>
                    <p><a id="backToApplication" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}" href="${client.baseUrl}">${msg("halsaBackHome")}</a></p>
                </#if>
            </#if>
        </div>
    </#if>
</@layout.registrationLayout>
