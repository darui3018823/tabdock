// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.0.0_subsccal-r6

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
        // アカウントモーダルにサブスクリプション管理ボタンを追加
        this.addSubscriptionButton();
    }

    addSubscriptionButton() {
        const observer = new MutationObserver((mutations, obs) => {
            const accountModal = document.getElementById('accountModal');
            if (!accountModal) return;

            const accountDataSection = accountModal.querySelector('.bg-black\\/20:nth-of-type(3)');
            if (!accountDataSection) return;

            const buttonContainer = accountDataSection.querySelector('.space-y-2');
            if (!buttonContainer) return;

            obs.disconnect(); // 監視を停止

            // 既存のボタンがあれば削除
            const existingButton = buttonContainer.querySelector('#subscriptionManageBtn');
            if (existingButton) {
                existingButton.remove();
            }

            // ボタンを作成
            const button = document.createElement('button');
            button.id = 'subscriptionManageBtn';
            button.className = 'w-full text-left text-xs text-white/70 hover:text-white/90 py-2 px-3 rounded hover:bg-white/10 transition-colors';
            button.textContent = 'サブスクリプション管理';
            button.addEventListener('click', () => this.showSubscriptionListModal());

            // データエクスポートボタンの前に挿入
            const exportButton = buttonContainer.firstChild;
            buttonContainer.insertBefore(button, exportButton);
        });

        // DOM変更の監視を開始
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async showSubscriptionListModal() {
        await this.loadSubscriptions(); // サブスクリプション情報を更新

        // サブスクリプション一覧モーダルを作成
        const modalHtml = `
            <div class="bg-gray-800 text-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto shadow-lg">
                <h2 class="text-xl font-bold mb-4">サブスクリプション一覧</h2>
                
                <div id="subscriptionListContent" class="space-y-2 mb-4">
                    ${this.subscriptions.map(sub => `
                        <div class="bg-black/20 p-4 rounded-lg hover:bg-black/30 cursor-pointer transition-colors subscription-item" data-id="${sub.id || ''}">
                            <div class="flex justify-between items-start">
                                <div>
                                    <div class="font-semibold text-lg">${sub.serviceName || ''}</div>
                                    <div class="text-sm text-white/70 mt-1">
                                        次回支払: ${sub.nextPaymentDate ? new Date(sub.nextPaymentDate).toLocaleDateString() : '未設定'}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-lg">${sub.amount || 0} ${sub.currency || 'JPY'}</div>
                                    <div class="text-sm text-white/70">${this.formatBillingCycle(sub.billingCycle || 'monthly')}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="border-t border-gray-700 pt-4 mt-4">
                    <div class="flex justify-between">
                        <button id="addNewSubscription" class="px-6 py-2 bg-green-600 hover:bg-green-500 rounded transition-colors">
                            新規追加
                        </button>
                        <button id="closeSubscriptionList" class="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors">
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        `;

        const subscriptionListModal = document.createElement('div');
        subscriptionListModal.id = 'subscriptionListModal';
        subscriptionListModal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-[70]';
        subscriptionListModal.innerHTML = modalHtml;

        document.body.appendChild(subscriptionListModal);

        // イベントリスナーの設定
        document.getElementById('closeSubscriptionList').addEventListener('click', () => {
            document.body.removeChild(subscriptionListModal);
        });

        document.getElementById('addNewSubscription').addEventListener('click', () => {
            document.body.removeChild(subscriptionListModal);
            const subscriptionManager = window.subscriptionManager;
            if (subscriptionManager) {
                subscriptionManager.showAddModal();
            }
        });

        const subscriptionItems = subscriptionListModal.querySelectorAll('.subscription-item');
        subscriptionItems.forEach(item => {
            item.addEventListener('click', () => {
                const subId = item.dataset.id;
                const subscription = this.subscriptions.find(s => s.id === subId);
                if (subscription) {
                    this.showSubscriptionDetail(subscription);
                }
            });
        });
    }

    formatBillingCycle(cycle) {
        return {
            'monthly': '月額',
            'yearly': '年額'
        }[cycle] || cycle;
    }

    showSubscriptionDetail(sub) {
        let paymentDetails = {};
        try {
            paymentDetails = sub.paymentDetails ? (
                typeof sub.paymentDetails === 'string' ? 
                JSON.parse(sub.paymentDetails) : 
                sub.paymentDetails
            ) : {};
        } catch (error) {
            console.warn('支払い詳細の解析に失敗しました:', error);
        }
        const detailsHTML = this.formatPaymentDetails(paymentDetails, sub.paymentMethod);

        const modalHtml = `
            <div class="bg-gray-800 text-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto shadow-lg">
                <h2 class="text-xl font-bold mb-6">${sub.serviceName} - ${sub.planName}</h2>

                <div class="space-y-6">
                    <div class="bg-black/20 rounded-lg p-4">
                        <h3 class="text-lg font-semibold mb-3">支払い情報</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <div class="text-white/70 text-sm">金額</div>
                                <div class="text-lg">${sub.amount} ${sub.currency}</div>
                            </div>
                            <div>
                                <div class="text-white/70 text-sm">支払いサイクル</div>
                                <div class="text-lg">${this.formatBillingCycle(sub.billingCycle)}</div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-black/20 rounded-lg p-4">
                        <h3 class="text-lg font-semibold mb-3">次回支払い</h3>
                        <div class="text-lg">${new Date(sub.nextPaymentDate).toLocaleDateString()}</div>
                    </div>

                    <div class="bg-black/20 rounded-lg p-4">
                        <h3 class="text-lg font-semibold mb-3">支払い方法</h3>
                        <div>
                            <div class="text-lg">${this.formatPaymentMethod(sub.paymentMethod)}</div>
                            ${detailsHTML}
                        </div>
                    </div>

                    <div class="bg-black/20 rounded-lg p-4">
                        <h3 class="text-lg font-semibold mb-3">ステータス</h3>
                        <div class="text-lg ${sub.status === 'active' ? 'text-green-400' : 'text-red-400'}">
                            ${this.formatStatus(sub.status)}
                        </div>
                    </div>
                </div>

                <div class="flex justify-between mt-6 border-t border-gray-700 pt-4">
                    <div>
                        <button id="editSubscription" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded transition-colors mr-2">
                            編集
                        </button>
                        <button id="cancelSubscription" class="px-6 py-2 bg-red-600 hover:bg-red-500 rounded transition-colors">
                            キャンセル
                        </button>
                    </div>
                    <button id="closeSubscriptionDetail" class="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors">
                        閉じる
                    </button>
                </div>
            </div>
        `;

        const detailModal = document.createElement('div');
        detailModal.id = 'subscriptionDetailModal';
        detailModal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-[70]';
        detailModal.innerHTML = modalHtml;

        document.body.appendChild(detailModal);

        // イベントリスナーの設定
        document.getElementById('closeSubscriptionDetail').addEventListener('click', () => {
            document.body.removeChild(detailModal);
        });

        document.getElementById('editSubscription').addEventListener('click', () => {
            document.body.removeChild(detailModal);
            this.handleEdit(sub);
        });

        document.getElementById('cancelSubscription').addEventListener('click', () => {
            document.body.removeChild(detailModal);
            this.handleCancellation(sub);
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