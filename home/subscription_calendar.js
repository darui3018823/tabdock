// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.0.0_subsccal-r4

class SubscriptionCalendarManager {
    constructor() {
        this.subscriptions = [];
        this.initialize();
    }

    async initialize() {
        await this.loadSubscriptions();
        this.integrateWithCalendar();
        this.setupSubscriptionList();
    }

    async loadSubscriptions() {
        try {
            const username = this.getUsername();
            if (!username) return;

            const response = await fetch('/api/subscriptions/list', {
                headers: { 'X-Username': username }
            });
            
            if (!response.ok) throw new Error('サブスクリプション取得エラー');
            this.subscriptions = await response.json();
        } catch (error) {
            console.error('サブスクリプション読み込みエラー:', error);
            this.subscriptions = [];
        }
    }

    getUsername() {
        if (window.getLoggedInUser) {
            const user = window.getLoggedInUser();
            if (user && user.username) return user.username;
        }
        const stored = localStorage.getItem('tabdock_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user && user.username) return user.username;
        }
        return null;
    }

    integrateWithCalendar() {
        // カレンダーのrenderSchedule関数をオーバーライド
        const originalRenderSchedule = window.renderSchedule;
        window.renderSchedule = (dateStr) => {
            originalRenderSchedule(dateStr);
            this.addSubscriptionToSchedule(dateStr);
        };
    }

    addSubscriptionToSchedule(dateStr) {
        const subscriptionsForDate = this.subscriptions.filter(sub => {
            const paymentDate = new Date(sub.nextPaymentDate);
            return paymentDate.toISOString().split('T')[0] === dateStr;
        });

        if (subscriptionsForDate.length === 0) return;

        const scheduleList = document.getElementById('scheduleList');
        if (!scheduleList) return;

        // サブスクリプションセクションのヘッダー
        const header = document.createElement('div');
        header.className = 'mt-4 mb-2 font-semibold text-sm text-white/70';
        header.textContent = 'サブスクリプション支払い予定';
        scheduleList.appendChild(header);

        // 各サブスクリプションの表示
        subscriptionsForDate.forEach(sub => {
            const li = document.createElement('li');
            li.classList.add('mb-2', 'subscription-item');

            const content = document.createElement('div');
            content.className = 'flex justify-between items-start';
            content.innerHTML = `
                <div class="flex-grow">
                    <div class="text-sm font-semibold">${sub.serviceName} (${sub.planName})</div>
                    <div class="text-xs text-white/70">
                        ${sub.amount} ${sub.currency} / ${this.formatBillingCycle(sub.billingCycle)}
                    </div>
                </div>
                <div class="ml-2">
                    <button class="text-xs text-blue-400 hover:underline subscription-detail-btn">
                        詳細
                    </button>
                </div>
            `;

            content.querySelector('.subscription-detail-btn').addEventListener('click', () => {
                this.showSubscriptionDetail(sub);
            });

            li.appendChild(content);
            scheduleList.appendChild(li);
        });
    }

    setupSubscriptionList() {
        const menuModal = document.getElementById('menuModal');
        if (!menuModal) return;

        // サブスクリプション一覧セクションの追加
        const section = document.createElement('div');
        section.className = 'mt-4 border-t border-gray-700 pt-4';
        section.innerHTML = `
            <h3 class="text-lg font-semibold mb-2">登録済みサブスクリプション</h3>
            <div id="subscriptionList" class="space-y-2 max-h-60 overflow-y-auto">
            </div>
        `;

        const modalContent = menuModal.querySelector('.bg-white\\/30');
        if (!modalContent) return;

        modalContent.appendChild(section);
        this.updateSubscriptionList();
    }

    async updateSubscriptionList() {
        await this.loadSubscriptions();
        const list = document.getElementById('subscriptionList');
        if (!list) return;

        list.innerHTML = '';
        this.subscriptions.forEach(sub => {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-2 rounded hover:bg-white/5';
            item.innerHTML = `
                <div>
                    <div class="font-semibold">${sub.serviceName}</div>
                    <div class="text-sm text-white/70">
                        次回支払: ${new Date(sub.nextPaymentDate).toLocaleDateString()}
                    </div>
                </div>
                <div class="text-right">
                    <div>${sub.amount} ${sub.currency}</div>
                    <div class="text-sm text-white/70">${this.formatBillingCycle(sub.billingCycle)}</div>
                </div>
            `;
            item.addEventListener('click', () => this.showSubscriptionDetail(sub));
            list.appendChild(item);
        });
    }

    formatBillingCycle(cycle) {
        return {
            'monthly': '月額',
            'yearly': '年額'
        }[cycle] || cycle;
    }

    showSubscriptionDetail(sub) {
        const paymentDetails = sub.paymentDetails ? JSON.parse(sub.paymentDetails) : {};
        const detailsHTML = this.formatPaymentDetails(paymentDetails, sub.paymentMethod);

        Swal.fire({
            title: `${sub.serviceName} - ${sub.planName}`,
            html: `
                <div class="text-left">
                    <div class="mb-3">
                        <div class="font-semibold">支払い情報</div>
                        <div>${sub.amount} ${sub.currency} / ${this.formatBillingCycle(sub.billingCycle)}</div>
                    </div>
                    <div class="mb-3">
                        <div class="font-semibold">次回支払日</div>
                        <div>${new Date(sub.nextPaymentDate).toLocaleDateString()}</div>
                    </div>
                    <div class="mb-3">
                        <div class="font-semibold">支払い方法</div>
                        <div>${this.formatPaymentMethod(sub.paymentMethod)}</div>
                        ${detailsHTML}
                    </div>
                    <div>
                        <div class="font-semibold">ステータス</div>
                        <div>${this.formatStatus(sub.status)}</div>
                    </div>
                </div>
            `,
            confirmButtonText: '閉じる',
            showDenyButton: true,
            denyButtonText: 'キャンセル',
            denyButtonColor: '#dc3545',
            showCancelButton: true,
            cancelButtonText: '編集',
            cancelButtonColor: '#3085d6'
        }).then((result) => {
            if (result.isDenied) {
                this.handleCancellation(sub);
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                this.handleEdit(sub);
            }
        });
    }

    formatPaymentMethod(method) {
        const methods = {
            'CC': 'クレジットカード',
            'PayPal': 'PayPal',
            'GooglePay': 'Google Pay',
            'ApplePay': 'Apple Pay',
            'PayPay': 'PayPay',
            'AmazonPay': 'Amazon Pay',
            'Other': 'その他'
        };
        return methods[method] || method;
    }

    formatPaymentDetails(details, method) {
        if (!details || Object.keys(details).length === 0) return '';

        let html = '<div class="text-sm text-gray-400 mt-1">';
        if (method === 'CC' && details.cardLastFour) {
            html += `末尾4桁: ${details.cardLastFour}`;
        } else if (method === 'PayPal' && details.paypalEmail) {
            html += `メール: ${details.paypalEmail}`;
        } else if (method === 'Other') {
            if (details.methodName) html += details.methodName;
            if (details.label) html += ` (${details.label})`;
        }
        html += '</div>';
        return html;
    }

    formatStatus(status) {
        const statuses = {
            'active': '有効',
            'cancelled': 'キャンセル済み',
            'expired': '期限切れ'
        };
        return statuses[status] || status;
    }

    async handleCancellation(sub) {
        const result = await Swal.fire({
            title: 'サブスクリプションのキャンセル',
            text: `${sub.serviceName}のサブスクリプションをキャンセルしますか？`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'キャンセル',
            confirmButtonColor: '#dc3545',
            cancelButtonText: '戻る'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/subscriptions/status?id=${sub.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Username': this.getUsername()
                    },
                    body: JSON.stringify({ status: 'cancelled' })
                });

                if (!response.ok) throw new Error('キャンセル処理に失敗しました');

                await Swal.fire('完了', 'サブスクリプションはキャンセルされました', 'success');
                await this.updateSubscriptionList();
            } catch (error) {
                Swal.fire('エラー', error.message, 'error');
            }
        }
    }

    async handleEdit(sub) {
        // サブスクリプション編集モーダルを表示
        const subscriptionManager = window.subscriptionManager;
        if (subscriptionManager) {
            subscriptionManager.showEditModal(sub);
        }
    }

    // 通知
    setupNotifications() {
        setInterval(() => this.checkUpcomingPayments(), 3600000); // 1時間ごと
        this.checkUpcomingPayments(); // 初回チェック
    }

    async checkUpcomingPayments() {
        try {
            const response = await fetch('/api/subscriptions/upcoming', {
                headers: { 'X-Username': this.getUsername() }
            });
            if (!response.ok) return;

            const upcoming = await response.json();
            upcoming.forEach(sub => {
                const paymentDate = new Date(sub.nextPaymentDate);
                const now = new Date();
                const daysUntilPayment = Math.ceil((paymentDate - now) / (1000 * 60 * 60 * 24));

                if (daysUntilPayment === 3 || daysUntilPayment === 1) {
                    Swal.fire({
                        title: 'サブスクリプション支払い予定',
                        html: `
                            <p>${sub.serviceName}の支払いが${daysUntilPayment}日後に予定されています。</p>
                            <p class="mt-2">金額: ${sub.amount} ${sub.currency}</p>
                        `,
                        icon: 'info',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 10000,
                        timerProgressBar: true
                    });
                }
            });
        } catch (error) {
            console.error('支払い予定チェックエラー:', error);
        }
    }
}

// インスタンスの作成と初期化
document.addEventListener('DOMContentLoaded', () => {
    window.subscriptionCalendarManager = new SubscriptionCalendarManager();
});