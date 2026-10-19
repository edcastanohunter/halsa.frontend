<#--
  Copied from Keycloak 26.4 base/login/register.ftl. Markup only: every user-profile attribute keeps
  its name and input (rendered by user-profile-commons.ftl's inputFieldByType), and so do `password`,
  `password-confirm`, `termsAccepted` and the recaptcha block. Two changes in order: the name fields
  come before the email (plan A.3: Nombre, Apellidos, Correo), and the passwords come last.
-->
<#import "template.ftl" as layout>
<#import "user-profile-commons.ftl" as userProfileCommons>
<#import "register-commons.ftl" as registerCommons>
<#import "password-commons.ftl" as passwordCommons>

<#macro profileField attribute>
    <div class="${properties.kcFormGroupClass!}">
        <label for="${attribute.name}" class="${properties.kcLabelClass!}">${advancedMsg(attribute.displayName!'')}<#if attribute.required> <span class="required" aria-hidden="true">*</span></#if></label>
        <#if attribute.annotations.inputHelperTextBefore??>
            <div class="${properties.kcInputHelperTextBeforeClass!}" id="form-help-text-before-${attribute.name}" aria-live="polite">${kcSanitize(advancedMsg(attribute.annotations.inputHelperTextBefore))?no_esc}</div>
        </#if>
        <@userProfileCommons.inputFieldByType attribute=attribute/>
        <#if messagesPerField.existsError('${attribute.name}')>
            <span id="input-error-${attribute.name}" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                ${kcSanitize(messagesPerField.get('${attribute.name}'))?no_esc}
            </span>
        </#if>
        <#if attribute.annotations.inputHelperTextAfter??>
            <div class="${properties.kcInputHelperTextAfterClass!}" id="form-help-text-after-${attribute.name}" aria-live="polite">${kcSanitize(advancedMsg(attribute.annotations.inputHelperTextAfter))?no_esc}</div>
        </#if>
    </div>
</#macro>

<@layout.registrationLayout displayMessage=messagesPerField.exists('global') displayRequiredFields=true; section>
    <#if section = "header">
        <#if messageHeader??>
            ${kcSanitize(msg("${messageHeader}"))?no_esc}
        <#else>
            ${msg("registerTitle")}
        </#if>
    <#elseif section = "form">
        <form id="kc-register-form" class="${properties.kcFormClass!}" action="${url.registrationAction}" method="post">

            <#-- Names first, then the account identifiers (username and/or email). -->
            <#assign accountFields = ["username", "email"]>
            <#list profile.attributes as attribute>
                <#if attribute.name == 'locale' && realm.internationalizationEnabled && locale.currentLanguageTag?has_content>
                    <input type="hidden" id="${attribute.name}" name="${attribute.name}" value="${locale.currentLanguageTag}"/>
                <#elseif !accountFields?seq_contains(attribute.name)>
                    <@profileField attribute=attribute/>
                </#if>
            </#list>
            <#list profile.attributes as attribute>
                <#if accountFields?seq_contains(attribute.name)>
                    <@profileField attribute=attribute/>
                </#if>
            </#list>
            <#list profile.html5DataAnnotations?keys as key>
                <script type="module" src="${url.resourcesPath}/js/${key}.js"></script>
            </#list>

            <#if passwordRequired??>
                <div class="${properties.kcFormGroupClass!}">
                    <label for="password" class="${properties.kcLabelClass!}">${msg("password")} <span class="required" aria-hidden="true">*</span></label>
                    <@passwordCommons.passwordInput name="password" autocomplete="new-password"
                        invalid=messagesPerField.existsError('password','password-confirm')
                        describedBy=messagesPerField.existsError('password')?then('input-error-password password-policy', 'password-policy')/>
                    <#if messagesPerField.existsError('password')>
                        <span id="input-error-password" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('password'))?no_esc}
                        </span>
                    </#if>
                    <@passwordCommons.policyHint id="password-policy" inputId="password"/>
                </div>

                <div class="${properties.kcFormGroupClass!}">
                    <label for="password-confirm" class="${properties.kcLabelClass!}">${msg("passwordConfirm")} <span class="required" aria-hidden="true">*</span></label>
                    <@passwordCommons.passwordInput name="password-confirm" autocomplete="new-password"
                        invalid=messagesPerField.existsError('password-confirm')
                        describedBy=messagesPerField.existsError('password-confirm')?then('input-error-password-confirm', '')/>
                    <#if messagesPerField.existsError('password-confirm')>
                        <span id="input-error-password-confirm" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('password-confirm'))?no_esc}
                        </span>
                    </#if>
                </div>
            </#if>

            <@registerCommons.termsAcceptance/>

            <p class="hl-notice">
                <span class="hl-icon hl-icon-shield" aria-hidden="true"></span>
                <span>${msg("halsaDataNotice")}<#if properties.halsaPrivacyUrl?has_content> <a class="hl-link" href="${properties.halsaPrivacyUrl}" target="_blank" rel="noopener noreferrer">${msg("halsaPrivacyLink")}</a></#if></span>
            </p>

            <#if recaptchaRequired?? && (recaptchaVisible!false)>
                <div class="form-group">
                    <div class="${properties.kcInputWrapperClass!}">
                        <div class="g-recaptcha" data-size="compact" data-sitekey="${recaptchaSiteKey}" data-action="${recaptchaAction}"></div>
                    </div>
                </div>
            </#if>

            <#if recaptchaRequired?? && !(recaptchaVisible!false)>
                <script>
                    function onSubmitRecaptcha(token) {
                        document.getElementById("kc-register-form").requestSubmit();
                    }
                </script>
                <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                    <button class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!} g-recaptcha"
                        data-sitekey="${recaptchaSiteKey}" data-callback='onSubmitRecaptcha' data-action='${recaptchaAction}' type="submit">
                        ${msg("halsaCreateAccount")}
                    </button>
                    <a class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" href="${url.loginUrl}">${msg("halsaHaveAccount")}</a>
                </div>
            <#else>
                <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                    <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("halsaCreateAccount")}"/>
                    <a class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" href="${url.loginUrl}">${msg("halsaHaveAccount")}</a>
                </div>
            </#if>
        </form>
        <script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
    </#if>
</@layout.registrationLayout>
