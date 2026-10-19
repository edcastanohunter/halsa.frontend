<#-- Copied from Keycloak 26.4 base/login/login-otp.ftl. Markup only: `otp`, `selectedCredentialId` and `login` are unchanged. -->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('totp'); section>
    <#if section="header">
        ${msg("halsaOtpTitle")}
    <#elseif section="form">
        <p class="hl-lead">${msg("halsaOtpIntro")}</p>
        <form id="kc-otp-login-form" class="${properties.kcFormClass!}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}"
            method="post">
            <#if otpLogin.userOtpCredentials?size gt 1>
                <fieldset class="${properties.kcFormGroupClass!}">
                    <legend class="${properties.kcLabelClass!}">${msg("halsaOtpDevice")}</legend>
                    <div class="hl-tiles">
                        <#list otpLogin.userOtpCredentials as otpCredential>
                            <input id="kc-otp-credential-${otpCredential?index}" class="${properties.kcLoginOTPListInputClass!}" type="radio" name="selectedCredentialId" value="${otpCredential.id}" <#if otpCredential.id == otpLogin.selectedCredentialId>checked="checked"</#if>>
                            <label for="kc-otp-credential-${otpCredential?index}" class="${properties.kcLoginOTPListClass!}">
                                <span class="${properties.kcLoginOTPListItemHeaderClass!}">
                                    <span class="${properties.kcLoginOTPListItemIconBodyClass!}">
                                      <i class="${properties.kcLoginOTPListItemIconClass!}" aria-hidden="true"></i>
                                    </span>
                                    <span class="${properties.kcLoginOTPListItemTitleClass!}">${otpCredential.userLabel}</span>
                                </span>
                            </label>
                        </#list>
                    </div>
                </fieldset>
            </#if>

            <div class="${properties.kcFormGroupClass!}">
                <label for="otp" class="${properties.kcLabelClass!}">${msg("loginOtpOneTime")}</label>
                <input id="otp" name="otp" autocomplete="one-time-code" type="text" class="${properties.kcInputClass!} hl-input-otp"
                       inputmode="numeric" pattern="[0-9]*" maxlength="6" data-halsa-otp
                       autofocus aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"
                       <#if messagesPerField.existsError('totp')>aria-describedby="input-error-otp-code"</#if>
                       dir="ltr" />

                <#if messagesPerField.existsError('totp')>
                    <span id="input-error-otp-code" class="${properties.kcInputErrorMessageClass!}"
                          aria-live="polite">
                        ${kcSanitize(messagesPerField.get('totp'))?no_esc}
                    </span>
                </#if>
            </div>

            <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                <input
                    class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
                    name="login" id="kc-login" type="submit" value="${msg("halsaOtpSubmit")}" />
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
