// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.6.0_subsc-r3

class SubscriptionManager {
    constructor() {
        this.modal = document.getElementById('subscriptionModal');
        this.form = document.getElementById('subscriptionForm');
        this.paymentMethodSelect = this.form?.querySelector('[name="paymentMethod"]') ?? null;
        this.notificationTimers = new Set();
        this.initialize();
    }

    initialize() {
        if (!this.modal || !this.form) {
            console.warn('[SubscriptionManager] モーダル要素が見つかりませんでした。');
            return;
        }

        this.hideAllPaymentDetails();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const registerAddButton = () => {
            const addButton = document.querySelector('[data-action="add-subscription"]');
            if (addButton) {
                addButton.addEventListener('click', () => this.showAddModal());
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', registerAddButton, { once: true });
        } else {
            registerAddButton();
        }

        this.paymentMethodSelect?.addEventListener('change', (e) => this.handlePaymentMethodChange(e));
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        const cancelBtn = document.getElementById('cancelSubscription');
        cancelBtn?.addEventListener('click', () => {
            this.hideModal();
            const scheduleTypeModal = document.getElementById('scheduleTypeModal');
            scheduleTypeModal?.classList.add('hidden');
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });

        window.addEventListener('subscription:request-open', () => this.showAddModal());
    }

    showAddModal() {
        const scheduleTypeModal = document.getElementById('scheduleTypeModal');
        if (scheduleTypeModal) {
            scheduleTypeModal.classList.add('hidden');
        }
        this.showModal();
    }

    showModal() {
        if (!this.modal) return;
        this.modal.classList.remove('hidden');
        const firstInput = this.form?.querySelector('input[name="serviceName"]');
        firstInput?.focus();
    }

    hideModal() {
        if (!this.modal) return;
        this.modal.classList.add('hidden');
        this.form?.reset();
        this.hideAllPaymentDetails();
    }

    handlePaymentMethodChange(event) {
        this.hideAllPaymentDetails();
        const method = event.target.value;
        const paymentDetails = document.getElementById('paymentDetails');
        if (!paymentDetails) return;

        if (method === 'CC') {
            paymentDetails.classList.remove('hidden');
            document.getElementById('ccDetails')?.classList.remove('hidden');
            Swal.fire({
                title: '注意',
                text: 'セキュリティ上の理由により、カード情報の全てを入力することはできません。末尾4桁のみ任意で記録できます。',
                icon: 'warning',
                confirmButtonText: '了解'
            });
        } else if (method === 'PayPal') {
            paymentDetails.classList.remove('hidden');
            document.getElementById('paypalDetails')?.classList.remove('hidden');
        } else if (method === 'Other') {
            paymentDetails.classList.remove('hidden');
            document.getElementById('otherDetails')?.classList.remove('hidden');
        }
    }

    hideAllPaymentDetails() {
        const paymentDetails = document.getElementById('paymentDetails');
        paymentDetails?.classList.add('hidden');
        ['ccDetails', 'paypalDetails', 'otherDetails'].forEach((id) => {
            document.getElementById(id)?.classList.add('hidden');
        });
    }

    async handleSubmit(event) {
        event.preventDefault();
        if (!this.form) return;

        const formData = new FormData(this.form);
        const amount = Number(formData.get('amount'));
        if (Number.isNaN(amount) || amount < 0) {
            Swal.fire({
                title: '入力エラー',
                text: '金額は0以上の数値を入力してください。',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return;
        }

        const payload = {
            serviceName: formData.get('serviceName'),
            planName: formData.get('planName'),
            amount,
            currency: formData.get('currency'),
            billingCycle: formData.get('billingCycle'),
            paymentMethod: formData.get('paymentMethod'),
            nextPaymentDate: formData.get('nextPaymentDate'),
            paymentDetails: {}
        };

        switch (payload.paymentMethod) {
            case 'CC':
                if (formData.get('cardLastFour')) {
                    payload.paymentDetails.cardLastFour = formData.get('cardLastFour');
                }
                break;
            case 'PayPal':
                if (formData.get('paypalEmail')) {
                    payload.paymentDetails.paypalEmail = formData.get('paypalEmail');
                }
                break;
            case 'Other':
                if (formData.get('otherPaymentMethod')) {
                    payload.paymentDetails.methodName = formData.get('otherPaymentMethod');
                }
                if (formData.get('otherPaymentLabel')) {
                    payload.paymentDetails.label = formData.get('otherPaymentLabel');
                }
                break;
            default:
                break;
        }

        try {
            let username = null;
            if (typeof window.getLoggedInUser === 'function') {
                const user = window.getLoggedInUser();
                if (user?.username) {
                    username = user.username;
                }
            }
            if (!username && localStorage.getItem('tabdock_user')) {
                const user = JSON.parse(localStorage.getItem('tabdock_user'));
                if (user?.username) {
                    username = user.username;
                }
            }

            if (!username) {
                throw new Error('ログインユーザー情報が取得できません。ログインしてください。');
            }

            const response = await fetch('/api/subscriptions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Username': encodeURIComponent(username)
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'サーバーエラーが発生しました');
            }

            const saved = await response.json().catch(() => null);

            await Swal.fire({
                title: '成功',
                text: 'サブスクリプションが正常に登録されました',
                icon: 'success',
                confirmButtonText: 'OK'
            });

            this.hideModal();

            const detail = {
                action: 'created',
                subscription: saved || payload
            };
            window.dispatchEvent(new CustomEvent('subscription:data-changed', { detail }));

            if (window.calendarManager?.refreshCalendar) {
                window.calendarManager.refreshCalendar({ keepSelection: true, forceReload: true }).catch(() => {});
            }

            await this.scheduleNotifications().catch(() => {});
        } catch (error) {
            Swal.fire({
                title: 'エラー',
                text: error.message,
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    }

    clearNotificationTimers() {
        if (!this.notificationTimers.size) return;
        for (const timerId of this.notificationTimers) {
            clearTimeout(timerId);
        }
        this.notificationTimers.clear();
    }

    async scheduleNotifications() {
        this.clearNotificationTimers();
        try {
            let username = null;
            if (typeof window.getLoggedInUser === 'function') {
                const user = window.getLoggedInUser();
                if (user?.username) username = user.username;
            }
            if (!username && localStorage.getItem('tabdock_user')) {
                const user = JSON.parse(localStorage.getItem('tabdock_user'));
                if (user?.username) username = user.username;
            }

            if (!username) {
                throw new Error('ログインユーザー情報が取得できません。ログインしてください。');
            }

            const response = await fetch('/api/subscriptions/upcoming', {
                headers: { 'X-Username': encodeURIComponent(username) },
                credentials: 'include'
            });
            if (!response.ok) throw new Error('通知の取得に失敗しました');

            const subscriptions = await response.json();

            // 空配列や不正データに対するガード
            if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
                console.info('通知対象のサブスクリプションが見つかりませんでした。');
                return;
            }

            subscriptions.forEach((sub) => {
                const paymentDate = new Date(sub.nextPaymentDate);
                if (Number.isNaN(paymentDate.getTime())) {
                    return;
                }

                const now = new Date();
                const threeDaysBefore = new Date(paymentDate);
                threeDaysBefore.setDate(paymentDate.getDate() - 3);
                const oneDayBefore = new Date(paymentDate);
                oneDayBefore.setDate(paymentDate.getDate() - 1);

                if (now < threeDaysBefore) {
                    const timeout = setTimeout(() => {
                        Swal.fire({
                            title: 'サブスクリプション支払い予定',
                            html: `<p>${sub.serviceName}の支払いが3日後に予定されています。</p>` +
                                  `<p>金額: ${sub.amount} ${sub.currency}</p>`,
                            icon: 'info',
                            confirmButtonText: '了解'
                        });
                        this.notificationTimers.delete(timeout);
                    }, threeDaysBefore.getTime() - now.getTime());
                    this.notificationTimers.add(timeout);
                }

                if (now < oneDayBefore) {
                    const timeout = setTimeout(() => {
                        Swal.fire({
                            title: 'サブスクリプション支払い予定',
                            html: `<p>${sub.serviceName}の支払いが明日予定されています。</p>` +
                                  `<p>金額: ${sub.amount} ${sub.currency}</p>`,
                            icon: 'warning',
                            confirmButtonText: '了解'
                        });
                        this.notificationTimers.delete(timeout);
                    }, oneDayBefore.getTime() - now.getTime());
                    this.notificationTimers.add(timeout);
                }
            });
        } catch (error) {
            console.error('通知スケジュールの設定に失敗しました:', error);
        }
    }
}

const subscriptionManager = new SubscriptionManager();
if (typeof window !== 'undefined') {
    window.subscriptionManager = subscriptionManager;
}
export { subscriptionManager };

subscriptionManager.scheduleNotifications();

setInterval(() => {
    subscriptionManager.scheduleNotifications();
}, 3600000);
