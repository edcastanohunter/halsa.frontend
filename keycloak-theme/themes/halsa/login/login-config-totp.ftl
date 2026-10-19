<#--
  Copied from Keycloak 26.4 base/login/login-config-totp.ftl. Markup only: `totp`, `userLabel`,
  `totpSecret`, `mode`, `logout-sessions` and `cancel-aia` are unchanged. The manual-entry key moves
  from a separate page (mode=manual) into a disclosure under the QR code, so both are on one screen.
-->
<#import "template.ftl" as layout>
<#import "password-commons.ftl" as passwordCommons>
<@layout.registrationLayout displayRequiredFields=false displayMessage=!messagesPerField.existsError('totp','userLabel'); section>

    <#if section = "header">
        ${msg("loginTotpTitle")}
    <#elseif section = "form">
        <ol id="kc-totp-settings" class="hl-steps">
            <li class="hl-step">
                <span class="hl-step-number" aria-hidden="true">1</span>
                <div class="hl-step-body">
                    <p class="hl-step-title">${msg("loginTotpStep1")}</p>
                    <ul id="kc-totp-supported-apps" class="hl-app-list">
                        <#list totp.supportedApplications as app>
                            <li>${msg(app)}</li>
                        </#list>
                    </ul>
                </div>
            </li>

            <li class="hl-step">
                <span class="hl-step-number" aria-hidden="true">2</span>
                <div class="hl-step-body">
                    <p class="hl-step-title">${msg("loginTotpStep2")}</p>
                    <img id="kc-totp-secret-qr-code" class="hl-qr" src="data:image/png;base64, ${totp.totpSecretQrCode}" alt="${msg("halsaTotpQrAlt")}" width="180" height="180">
                    <details class="hl-disclosure"<#if mode?? && mode = "manual"> open</#if>>
                        <summary>${msg("loginTotpUnableToScan")}</summary>
                        <p class="hl-hint">${msg("loginTotpManualStep2")}</p>
                        <div class="hl-secret">
                            <code id="kc-totp-secret-key">${totp.totpSecretEncoded}</code>
                            <button type="button" class="hl-btn hl-btn-secondary hl-btn-sm" data-halsa-copy="kc-totp-secret-key"
                                    data-label-done="${msg("halsaCopied")}">
                                <span class="hl-icon hl-icon-copy" aria-hidden="true"></span>
                                <span data-halsa-copy-label>${msg("halsaCopy")}</span>
                            </button>
                        </div>
                        <ul class="hl-totp-params">
                            <li id="kc-totp-type">${msg("loginTotpType")}: ${msg("loginTotp." + totp.policy.type)}</li>
                            <li id="kc-totp-algorithm">${msg("loginTotpAlgorithm")}: ${totp.policy.getAlgorithmKey()}</li>
                            <li id="kc-totp-digits">${msg("loginTotpDigits")}: ${totp.policy.digits}</li>
                            <#if totp.policy.type = "totp">
                                <li id="kc-totp-period">${msg("loginTotpInterval")}: ${totp.policy.period}</li>
                            <#elseif totp.policy.type = "hotp">
                                <li id="kc-totp-counter">${msg("loginTotpCounter")}: ${totp.policy.initialCounter}</li>
                            </#if>
                        </ul>
                    </details>
                </div>
            </li>

            <li class="hl-step">
                <span class="hl-step-number" aria-hidden="true">3</span>
                <div class="hl-step-body">
                    <p class="hl-step-title">${msg("loginTotpStep3")}</p>

                    <form action="${url.loginAction}" class="${properties.kcFormClass!}" id="kc-totp-settings-form" method="post">
                        <div class="${properties.kcFormGroupClass!}">
                            <label for="totp" class="${properties.kcLabelClass!}">${msg("authenticatorCode")} <span class="required" aria-hidden="true">*</span></label>
                            <input type="text" id="totp" name="totp" autocomplete="one-time-code" class="${properties.kcInputClass!} hl-input-otp"
                                   aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"
                                   <#if messagesPerField.existsError('totp')>aria-describedby="input-error-otp-code"</#if>
                                   inputmode="numeric" pattern="[0-9]*" maxlength="${totp.policy.digits}" data-halsa-otp required
                                   dir="ltr"
                            />

                            <#if messagesPerField.existsError('totp')>
                                <span id="input-error-otp-code" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                                    ${kcSanitize(messagesPerField.get('totp'))?no_esc}
                                </span>
                            </#if>
                            <input type="hidden" id="totpSecret" name="totpSecret" value="${totp.totpSecret}" />
                            <#if mode??><input type="hidden" id="mode" name="mode" value="${mode}"/></#if>
                        </div>

                        <div class="${properties.kcFormGroupClass!}">
                            <label for="userLabel" class="${properties.kcLabelClass!}">${msg("loginTotpDeviceName")} <#if totp.otpCredentials?size gte 1><span class="required" aria-hidden="true">*</span></#if></label>
                            <input type="text" class="${properties.kcInputClass!}" id="userLabel" name="userLabel" autocomplete="off"
                                   aria-invalid="<#if messagesPerField.existsError('userLabel')>true</#if>"
                                   aria-describedby="<#if messagesPerField.existsError('userLabel')>input-error-otp-label <#else></#if>user-label-hint" dir="ltr"
                            />
                            <span id="user-label-hint" class="hl-hint">${msg("loginTotpStep3DeviceName")}</span>

                            <#if messagesPerField.existsError('userLabel')>
                                <span id="input-error-otp-label" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                                    ${kcSanitize(messagesPerField.get('userLabel'))?no_esc}
                                </span>
                            </#if>
                        </div>

                        <@passwordCommons.logoutOtherSessions/>

                        <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                            <#if isAppInitiatedAction??>
                                <input type="submit"
                                       class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonLargeClass!}"
                                       id="saveTOTPBtn" value="${msg("halsaTotpSubmit")}"
                                />
                                <button type="submit"
                                        class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonLargeClass!}"
                                        id="cancelTOTPBtn" name="cancel-aia" value="true">${msg("doCancel")}
                                </button>
                            <#else>
                                <input type="submit"
                                       class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
                                       id="saveTOTPBtn" value="${msg("halsaTotpSubmit")}"
                                />
                            </#if>
                        </div>
                    </form>
                </div>
            </li>
        </ol>
    </#if>
</@layout.registrationLayout>
