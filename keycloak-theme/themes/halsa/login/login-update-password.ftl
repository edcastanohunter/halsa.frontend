<#-- Copied from Keycloak 26.4 base/login/login-update-password.ftl. Markup only, plus the policy checklist. -->
<#import "template.ftl" as layout>
<#import "password-commons.ftl" as passwordCommons>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('password','password-confirm'); section>
    <#if section = "header">
        ${msg("updatePasswordTitle")}
    <#elseif section = "form">
        <form id="kc-passwd-update-form" class="${properties.kcFormClass!}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
            <div class="${properties.kcFormGroupClass!}">
                <label for="password-new" class="${properties.kcLabelClass!}">${msg("passwordNew")}</label>
                <@passwordCommons.passwordInput name="password-new" autocomplete="new-password" autofocus=true
                    invalid=messagesPerField.existsError('password','password-confirm')
                    describedBy=messagesPerField.existsError('password')?then('input-error-password password-policy', 'password-policy')/>
                <#if messagesPerField.existsError('password')>
                    <span id="input-error-password" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                        ${kcSanitize(messagesPerField.get('password'))?no_esc}
                    </span>
                </#if>
                <@passwordCommons.policyHint id="password-policy" inputId="password-new"/>
            </div>

            <div class="${properties.kcFormGroupClass!}">
                <label for="password-confirm" class="${properties.kcLabelClass!}">${msg("passwordConfirm")}</label>
                <@passwordCommons.passwordInput name="password-confirm" autocomplete="new-password"
                    invalid=messagesPerField.existsError('password-confirm')
                    describedBy=messagesPerField.existsError('password-confirm')?then('input-error-password-confirm', '')/>
                <#if messagesPerField.existsError('password-confirm')>
                    <span id="input-error-password-confirm" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                        ${kcSanitize(messagesPerField.get('password-confirm'))?no_esc}
                    </span>
                </#if>
            </div>

            <@passwordCommons.logoutOtherSessions/>

            <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                <#if isAppInitiatedAction??>
                    <input name="login" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("halsaSavePassword")}" />
                    <button class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonLargeClass!}" type="submit" name="cancel-aia" value="true">${msg("doCancel")}</button>
                <#else>
                    <input name="login" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("halsaSavePassword")}" />
                </#if>
            </div>
        </form>
        <script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
    </#if>
</@layout.registrationLayout>
