// 2025 TabDock: darui3018823 All rights reserved.
// All works created by darui3018823 associated with this repository are the intellectual property of darui3018823.
// Packages and other third-party materials used in this repository are subject to their respective licenses and copyrights.
// This code Version: 5.3.0_subsccal-r1

class SubscriptionCalendarManager {
    constructor() {
        this.subscriptions = [];
        this.initialize();
    }

    getDisplayWidth(str = '') {
        let width = 0;
        for (const ch of String(str)) {
            // ASCII (0x20-0x7E) および 半角カナ(FF61-FF9F) を半角、それ以外は全角扱い
            if (/[\u0020-\u007E\uFF61-\uFF9F]/.test(ch)) {
                width += 1;
            } else {
                width += 2;
            }
        }
        return width;
    }

    truncateByDisplayWidth(str = '', maxHalfWidth = 20) {
        if (this.getDisplayWidth(str) <= maxHalfWidth) return str;
        let acc = '';
        let w = 0;
        for (const ch of String(str)) {
            const cw = /[\u0020-\u007E\uFF61-\uFF9F]/.test(ch) ? 1 : 2;
            if (w + cw > maxHalfWidth) break;
            acc += ch;
            w += cw;
        }
        return acc + '...';
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
            const data = await response.json().catch(() => null);
            this.subscriptions = Array.isArray(data) ? data : [];
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
        const originalRenderSchedule = window.renderSchedule;
        window.renderSchedule = (dateStr) => {
            originalRenderSchedule(dateStr);
            this.addSubscriptionToSchedule(dateStr);
        };
    }

    addSubscriptionToSchedule(dateStr) {
        if (!Array.isArray(this.subscriptions) || this.subscriptions.length === 0) return;
        const subscriptionsForDate = this.subscriptions.filter(sub => {
            if (!sub || !sub.nextPaymentDate) return false;
            const paymentDate = new Date(sub.nextPaymentDate);
            if (Number.isNaN(paymentDate.getTime())) return false;
            return paymentDate.toISOString().split('T')[0] === dateStr;
        });

        if (subscriptionsForDate.length === 0) return;

        const scheduleList = document.getElementById('scheduleList');
        if (!scheduleList) return;

        const header = document.createElement('div');
        header.className = 'mt-4 mb-2 font-semibold text-sm text-white/70';
        header.textContent = 'サブスクリプション支払い予定';
        scheduleList.appendChild(header);

        subscriptionsForDate.forEach(sub => {
            const li = document.createElement('li');
            li.classList.add('mb-2', 'subscription-item');

            const content = document.createElement('div');
            content.className = 'flex justify-between items-start';
            content.innerHTML = `
                <div class="flex-grow">
                    <div class="text-sm font-semibold">${this.truncateByDisplayWidth(sub.serviceName || '', 20)}</div>
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

            obs.disconnect();

            const existingButton = buttonContainer.querySelector('#subscriptionManageBtn');
            if (existingButton) {
                existingButton.remove();
            }

            const button = document.createElement('button');
            button.id = 'subscriptionManageBtn';
            button.className = 'w-full text-left text-xs text-white/70 hover:text-white/90 py-2 px-3 rounded hover:bg-white/10 transition-colors';
            button.textContent = 'サブスクリプション管理';
            button.addEventListener('click', () => this.showSubscriptionListModal());

            const exportButton = buttonContainer.firstChild;
            buttonContainer.insertBefore(button, exportButton);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    async showSubscriptionListModal() {
        await this.loadSubscriptions();

        const monthlyTotal = this.subscriptions
            .filter(sub => sub.billingCycle === 'monthly' && sub.status === 'active')
            .reduce((sum, sub) => sum + (parseFloat(sub.amount) || 0), 0);
        
        const yearlyTotal = this.subscriptions
            .filter(sub => sub.billingCycle === 'yearly' && sub.status === 'active')
            .reduce((sum, sub) => sum + (parseFloat(sub.amount) || 0), 0);

        const modalHtml = `
            <div class="td-modal-panel td-modal-4xl max-h-screen overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-bold">サブスクリプション一覧</h2>
                    <div class="flex gap-4">
                        <div class="text-right">
                            <div class="text-sm text-white/70">月額合計</div>
                            <div class="font-semibold text-lg text-green-400">${monthlyTotal.toLocaleString()} JPY</div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm text-white/70">年額合計</div>
                            <div class="font-semibold text-lg text-green-400">${yearlyTotal.toLocaleString()} JPY</div>
                        </div>
                    </div>
                </div>
                
                <div id="subscriptionListContent" class="space-y-3 mb-6">
                    ${this.subscriptions.map(sub => `
                        <div class="bg-black/20 p-4 rounded-lg hover:bg-black/30 cursor-pointer transition-colors subscription-item group" data-id="${sub.id || ''}">
                            <div class="flex justify-between items-start">
                                <div class="flex-grow">
                                    <div class="font-semibold text-lg flex items-center">
                                        ${sub.serviceName || ''}
                                        ${sub.status === 'active' ? 
                                            '<span class="ml-2 text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">有効</span>' : 
                                            '<span class="ml-2 text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">無効</span>'
                                        }
                                    </div>
                                    <div class="text-sm text-white/70 mt-1">
                                        プラン: ${sub.planName || '未設定'}
                                    </div>
                                    <div class="text-sm text-white/70">
                                        次回支払: ${sub.nextPaymentDate ? new Date(sub.nextPaymentDate).toLocaleDateString() : '未設定'}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-lg font-semibold">${sub.amount || 0} ${sub.currency || 'JPY'}</div>
                                    <div class="text-sm text-white/70">${this.formatBillingCycle(sub.billingCycle || 'monthly')}</div>
                                    <button class="mt-2 px-3 py-1 text-xs text-blue-400 hover:bg-blue-400/10 rounded-full">
                                        詳細を表示 →
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="border-t border-gray-700 pt-4">
                    <div class="flex justify-between">
                        <button id="addNewSubscription" class="px-6 py-2 bg-green-600 hover:bg-green-500 rounded transition-colors flex items-center">
                            <span class="text-lg mr-1">+</span>
                            <span>新規追加</span>
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
    subscriptionListModal.className = 'td-modal-overlay z-[70]';
        subscriptionListModal.innerHTML = modalHtml;

        document.body.appendChild(subscriptionListModal);

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
            // カード全体クリックで詳細（一覧は閉じない）
            item.addEventListener('click', () => {
                const subId = item.dataset.id;
                const subscription = this.subscriptions.find(s => String(s.id) === String(subId));
                if (subscription) {
                    this.showSubscriptionDetail(subscription);
                }
            });

            // 詳細ボタン（クリック伝播を止めるが、動作は同じ）
            const detailButton = item.querySelector('.text-blue-400');
            if (detailButton) {
                detailButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const subId = item.dataset.id;
                    const subscription = this.subscriptions.find(s => String(s.id) === String(subId));
                    if (subscription) {
                        this.showSubscriptionDetail(subscription);
                    }
                });
            }
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
            <div class="td-modal-panel td-modal-lg max-h-screen overflow-y-auto">
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
                            <div class="text-lg" id="paymentMethodContainer">
                                ${this.formatPaymentMethod(sub.paymentMethod)}
                            </div>
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
                    <div class="space-x-2">
                        <button id="editSubscription" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded transition-colors">
                            編集
                        </button>
                        <button id="deleteSubscription" class="px-6 py-2 bg-red-700 hover:bg-red-600 rounded transition-colors">
                            削除
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
    detailModal.className = 'td-modal-overlay z-[80]';
        detailModal.innerHTML = modalHtml;

        document.body.appendChild(detailModal);

        document.getElementById('closeSubscriptionDetail').addEventListener('click', () => {
            document.body.removeChild(detailModal);
        });

        document.getElementById('editSubscription').addEventListener('click', () => {
            document.body.removeChild(detailModal);
            this.handleEdit(sub);
        });

        const deleteBtn = document.getElementById('deleteSubscription');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                await this.handleDelete(sub, detailModal);
            });
        }
    }

    formatPaymentMethod(method) {
        const methods = {
            'CC': {
                text: 'クレジットカード',
                logo: '/home/assets/payment/credit-card.png',
                class: 'h-6 inline-block mr-2'
            },
            'PayPal': {
                text: 'PayPal',
                logo: '/home/assets/payment/pp_h_rgb.png',
                class: 'h-6 inline-block mr-2'
            },
            'GooglePay': {
                text: 'Google Pay',
                logo: '/home/assets/payment/google-pay-mark_800.svg',
                class: 'h-6 inline-block mr-2'
            },
            'ApplePay': {
                text: 'Apple Pay',
                logo: '/home/assets/payment/Apple_Pay_Mark_RGB_041619.svg',
                class: 'h-6 inline-block mr-2'
            },
            'PayPay': {
                text: 'PayPay',
                logo: '/home/assets/payment/paypay_3_rgb.png',
                class: 'h-6 inline-block mr-2'
            },
            'AmazonPay': {
                text: 'Amazon Pay',
                logo: '/home/assets/payment/Black-XL.png',
                class: 'h-6 inline-block mr-2'
            },
            'Other': {
                text: 'その他'
            }
        };

        const methodInfo = methods[method] || { text: method };

        if (methodInfo.logo) {
            return `
                <div class="flex items-center">
                    <img src="${methodInfo.logo}" alt="${methodInfo.text}" class="${methodInfo.class}" onerror="this.style.display='none'">
                    <span>${methodInfo.text}</span>
                </div>
            `;
        }
        
        return methodInfo.text;
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

    async handleDelete(sub, detailModalEl) {
        const result = await Swal.fire({
            title: 'サブスクリプションの削除',
            html: `このサブスクリプション「<b>${sub.serviceName}</b>」を完全に削除します。<br>この操作は元に戻せません。実行しますか？`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '削除する',
            confirmButtonColor: '#d33',
            cancelButtonText: '戻る'
        });

        if (!result.isConfirmed) return;

        try {
            const response = await fetch(`/api/subscriptions/delete?id=${sub.id}`, {
                method: 'DELETE',
                headers: {
                    'X-Username': this.getUsername()
                }
            });

            if (!response.ok) {
                const msg = await response.text();
                throw new Error(msg || '削除に失敗しました');
            }

            await Swal.fire('削除完了', 'サブスクリプションを削除しました', 'success');

            // データとUI更新
            await this.loadSubscriptions();
            await this.updateSubscriptionList();
            if (detailModalEl && document.body.contains(detailModalEl)) {
                document.body.removeChild(detailModalEl);
            }
        } catch (error) {
            Swal.fire('エラー', error.message, 'error');
        }
    }

    // サブスクリプション一覧モーダルが開いていれば、その内容を最新のデータで更新する
    async updateSubscriptionList() {
        await this.loadSubscriptions();

        const listModal = document.getElementById('subscriptionListModal');
        if (!listModal) return; // モーダルが出ていなければ何もしない

        const container = listModal.querySelector('#subscriptionListContent');
        if (!container) return;

        container.innerHTML = this.subscriptions.map(sub => `
            <div class="bg-black/20 p-4 rounded-lg hover:bg-black/30 cursor-pointer transition-colors subscription-item group" data-id="${sub.id || ''}">
                <div class="flex justify-between items-start">
                    <div class="flex-grow">
                        <div class="font-semibold text-lg flex items-center">
                            ${sub.serviceName || ''}
                            ${sub.status === 'active' ? 
                                '<span class="ml-2 text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">有効</span>' : 
                                '<span class="ml-2 text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">無効</span>'
                            }
                        </div>
                        <div class="text-sm text-white/70 mt-1">
                            プラン: ${sub.planName || '未設定'}
                        </div>
                        <div class="text-sm text-white/70">
                            次回支払: ${sub.nextPaymentDate ? new Date(sub.nextPaymentDate).toLocaleDateString() : '未設定'}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-semibold">${sub.amount || 0} ${sub.currency || 'JPY'}</div>
                        <div class="text-sm text-white/70">${this.formatBillingCycle(sub.billingCycle || 'monthly')}</div>
                        <button class="mt-2 px-3 py-1 text-xs text-blue-400 hover:bg-blue-400/10 rounded-full">
                            詳細を表示 →
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // 詳細ボタンの再バインド
        const subscriptionItems = listModal.querySelectorAll('.subscription-item');
        subscriptionItems.forEach(item => {
            // カード全体クリックでも詳細（一覧は閉じない）
            item.addEventListener('click', () => {
                const subId = item.dataset.id;
                const subscription = this.subscriptions.find(s => String(s.id) === String(subId));
                if (subscription) {
                    this.showSubscriptionDetail(subscription);
                }
            });

            // ボタン側も同様（クリック伝播は止める）
            const detailButton = item.querySelector('.text-blue-400');
            if (detailButton) {
                detailButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const subId = item.dataset.id;
                    const subscription = this.subscriptions.find(s => String(s.id) === String(subId));
                    if (subscription) {
                        this.showSubscriptionDetail(subscription);
                    }
                });
            }
        });
    }

    async handleEdit(sub) {
        const modalHtml = `
            <div class="td-modal-panel td-modal-lg max-h-screen overflow-y-auto">
                <h2 class="text-xl font-bold mb-6">サブスクリプション編集</h2>
                
                <form id="editSubscriptionForm" class="space-y-6">
                    <div class="bg-black/20 rounded-lg p-4">
                        <div class="grid gap-4">
                            <div>
                                <label class="block text-white/70 text-sm mb-1">サービス名</label>
                                <input type="text" name="serviceName" value="${sub.serviceName}" 
                                    class="w-full bg-gray-700 text-white rounded px-3 py-2">
                            </div>
                            <div>
                                <label class="block text-white/70 text-sm mb-1">プラン名</label>
                                <input type="text" name="planName" value="${sub.planName}" 
                                    class="w-full bg-gray-700 text-white rounded px-3 py-2">
                            </div>
                        </div>
                    </div>

                    <div class="bg-black/20 rounded-lg p-4">
                        <div class="grid gap-4">
                            <div>
                                <label class="block text-white/70 text-sm mb-1">支払い金額</label>
                                <input type="number" name="amount" value="${sub.amount}" 
                                    class="w-full bg-gray-700 text-white rounded px-3 py-2">
                            </div>
                            <div>
                                <label class="block text-white/70 text-sm mb-1">通貨</label>
                                <select name="currency" class="w-full bg-gray-700 text-white rounded px-3 py-2">
                                    <option value="JPY" ${sub.currency === 'JPY' ? 'selected' : ''}>JPY</option>
                                    <option value="USD" ${sub.currency === 'USD' ? 'selected' : ''}>USD</option>
                                    <option value="EUR" ${sub.currency === 'EUR' ? 'selected' : ''}>EUR</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-white/70 text-sm mb-1">支払いサイクル</label>
                                <select name="billingCycle" class="w-full bg-gray-700 text-white rounded px-3 py-2">
                                    <option value="monthly" ${sub.billingCycle === 'monthly' ? 'selected' : ''}>月額</option>
                                    <option value="yearly" ${sub.billingCycle === 'yearly' ? 'selected' : ''}>年額</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="bg-black/20 rounded-lg p-4">
                        <div class="grid gap-4" id="paymentFieldsGrid">
                            <div>
                                <label class="block text-white/70 text-sm mb-1">支払い方法</label>
                                <select name="paymentMethod" class="w-full bg-gray-700 text-white rounded px-3 py-2" id="paymentMethodSelect">
                                    <option value="CC" ${sub.paymentMethod === 'CC' ? 'selected' : ''}>クレジットカード</option>
                                    <option value="PayPal" ${sub.paymentMethod === 'PayPal' ? 'selected' : ''}>PayPal</option>
                                    <option value="GooglePay" ${sub.paymentMethod === 'GooglePay' ? 'selected' : ''}>Google Pay</option>
                                    <option value="ApplePay" ${sub.paymentMethod === 'ApplePay' ? 'selected' : ''}>Apple Pay</option>
                                    <option value="PayPay" ${sub.paymentMethod === 'PayPay' ? 'selected' : ''}>PayPay</option>
                                    <option value="AmazonPay" ${sub.paymentMethod === 'AmazonPay' ? 'selected' : ''}>Amazon Pay</option>
                                    <option value="Other" ${sub.paymentMethod === 'Other' ? 'selected' : ''}>その他</option>
                                </select>
                            </div>
                            <div id="additionalPaymentFields"></div>
                            <div id="nextPaymentDateContainer">
                                <label class="block text-white/70 text-sm mb-1">次回支払い日</label>
                                <input type="date" name="nextPaymentDate" value="${sub.nextPaymentDate.split('T')[0]}" 
                                    class="w-full bg-gray-700 text-white rounded px-3 py-2">
                            </div>
                        </div>
                    </div>
                </form>

                <div class="flex justify-between items-center mt-6 border-t border-gray-700 pt-4">
                    <div class="flex items-center gap-2">
                        <button id="saveSubscriptionEdit" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded transition-colors">
                            保存
                        </button>
                        <button id="cancelSubscriptionFromEdit" class="px-6 py-2 bg-red-600 hover:bg-red-500 rounded transition-colors">
                            キャンセル
                        </button>
                    </div>
                    <button id="closeEditForm" class="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors">
                        閉じる
                    </button>
                </div>
            </div>
        `;

    const editModal = document.createElement('div');
        editModal.id = 'subscriptionEditModal';
    editModal.className = 'td-modal-overlay z-[80]';
        editModal.innerHTML = modalHtml;

        document.body.appendChild(editModal);

        let paymentDetails = {};
        try {
            if (sub.paymentDetails) {
                paymentDetails = typeof sub.paymentDetails === 'string' ? 
                    JSON.parse(sub.paymentDetails) : 
                    sub.paymentDetails;
            }
            console.log('Processed payment details:', paymentDetails);
        } catch (error) {
            console.error('Payment details parse error:', error);
            paymentDetails = {};
        }

        function updatePaymentFields() {
            const paymentMethodSelect = document.getElementById('paymentMethodSelect');
            const additionalFields = document.getElementById('additionalPaymentFields');
            const nextPaymentDateContainer = document.getElementById('nextPaymentDateContainer');
            const paymentFieldsGrid = document.getElementById('paymentFieldsGrid');

            if (!paymentMethodSelect || !additionalFields || !nextPaymentDateContainer || !paymentFieldsGrid) {
                console.error('Required elements not found');
                return;
            }

            const method = paymentMethodSelect.value;
            const details = paymentDetails || {};

            // 既存の備考フィールドがあれば値を保持
            let existingNoteValue = '';
            const existingNoteInput = document.querySelector('input[name="label"]');
            if (existingNoteInput) existingNoteValue = existingNoteInput.value;

            // 次回支払い日の値も保持
            let existingNextDateValue = '';
            const existingNextDateInput = nextPaymentDateContainer.querySelector('input[name="nextPaymentDate"]');
            if (existingNextDateInput) existingNextDateValue = existingNextDateInput.value;

            // 追加フィールドを一旦クリア
            additionalFields.innerHTML = '';

            // デフォルトは1カラム
            paymentFieldsGrid.className = 'grid gap-4';

            // 次回支払い日コンテナを通常状態に戻す
            nextPaymentDateContainer.className = '';
            nextPaymentDateContainer.innerHTML = `
                <label class="block text-white/70 text-sm mb-1">次回支払い日</label>
                <input type="date" name="nextPaymentDate" value="${existingNextDateValue || sub.nextPaymentDate.split('T')[0]}" 
                    class="w-full bg-gray-700 text-white rounded px-3 py-2">
            `;

            // 既存の備考コンテナがあれば一旦削除（Other以外）
            const existingNoteContainer = document.getElementById('noteFieldContainer');
            if (existingNoteContainer && method !== 'Other') {
                existingNoteContainer.remove();
            }

            switch (method) {
                case 'CC': {
                    const ccDiv = document.createElement('div');
                    ccDiv.className = 'grid gap-4';
                    const ccInputDiv = document.createElement('div');
                    const ccLabel = document.createElement('label');
                    ccLabel.className = 'block text-white/70 text-sm mb-1';
                    ccLabel.textContent = 'カード末尾4桁';
                    const ccInput = document.createElement('input');
                    ccInput.type = 'text';
                    ccInput.name = 'cardLastFour';
                    ccInput.pattern = '[0-9]{4}';
                    ccInput.maxLength = 4;
                    ccInput.value = details.cardLastFour || '';
                    ccInput.className = 'w-full bg-gray-700 text-white rounded px-3 py-2';
                    ccInput.placeholder = '1234';
                    ccInputDiv.appendChild(ccLabel);
                    ccInputDiv.appendChild(ccInput);
                    ccDiv.appendChild(ccInputDiv);
                    additionalFields.appendChild(ccDiv);
                    break;
                }
                case 'PayPal': {
                    const ppDiv = document.createElement('div');
                    ppDiv.className = 'grid gap-4';
                    const ppInputDiv = document.createElement('div');
                    const ppLabel = document.createElement('label');
                    ppLabel.className = 'block text-white/70 text-sm mb-1';
                    ppLabel.textContent = 'PayPalメールアドレス';
                    const ppInput = document.createElement('input');
                    ppInput.type = 'email';
                    ppInput.name = 'paypalEmail';
                    ppInput.value = details.paypalEmail || '';
                    ppInput.className = 'w-full bg-gray-700 text-white rounded px-3 py-2';
                    ppInput.placeholder = 'example@example.com';
                    ppInputDiv.appendChild(ppLabel);
                    ppInputDiv.appendChild(ppInput);
                    ppDiv.appendChild(ppInputDiv);
                    additionalFields.appendChild(ppDiv);
                    break;
                }
                case 'Other': {
                    // 親グリッドを2カラムに切替（1行目: 支払い方法 | 支払い方法名、2行目: 次回支払い日 | 備考）
                    paymentFieldsGrid.className = 'grid grid-cols-2 gap-4';

                    // 1行目右: 支払い方法名
                    const methodDiv = document.createElement('div');
                    const methodLabel = document.createElement('label');
                    methodLabel.className = 'block text-white/70 text-sm mb-1';
                    methodLabel.textContent = '支払い方法名';
                    const methodInput = document.createElement('input');
                    methodInput.type = 'text';
                    methodInput.name = 'methodName';
                    methodInput.value = details.methodName || '';
                    methodInput.className = 'w-full bg-gray-700 text-white rounded px-3 py-2';
                    methodInput.placeholder = '銀行振込など';
                    methodDiv.appendChild(methodLabel);
                    methodDiv.appendChild(methodInput);
                    additionalFields.appendChild(methodDiv);

                    // 2行目右: 備考（次回支払い日の兄弟要素として配置）
                    let noteDiv = document.getElementById('noteFieldContainer');
                    if (!noteDiv) {
                        noteDiv = document.createElement('div');
                        noteDiv.id = 'noteFieldContainer';
                    } else {
                        noteDiv.innerHTML = '';
                    }
                    const noteLabel = document.createElement('label');
                    noteLabel.className = 'block text-white/70 text-sm mb-1';
                    noteLabel.textContent = '備考';
                    const noteInput = document.createElement('input');
                    noteInput.type = 'text';
                    noteInput.name = 'label';
                    noteInput.value = existingNoteValue || details.label || '';
                    noteInput.className = 'w-full bg-gray-700 text-white rounded px-3 py-2';
                    noteInput.placeholder = 'メモ';
                    noteDiv.appendChild(noteLabel);
                    noteDiv.appendChild(noteInput);

                    // 次回支払い日コンテナの直後に備考を追加（順序: select, method, nextDate, note）
                    if (!noteDiv.parentElement) {
                        paymentFieldsGrid.insertBefore(noteDiv, nextPaymentDateContainer.nextSibling);
                    } else if (noteDiv.parentElement !== paymentFieldsGrid) {
                        noteDiv.parentElement.removeChild(noteDiv);
                        paymentFieldsGrid.insertBefore(noteDiv, nextPaymentDateContainer.nextSibling);
                    }
                    break;
                }
            }
        }

        document.getElementById('closeEditForm').addEventListener('click', () => {
            document.body.removeChild(editModal);
        });

        // 解約（キャンセル）ボタン: 成功時のみモーダルを閉じる
        const cancelBtn = document.getElementById('cancelSubscriptionFromEdit');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', async () => {
                // 編集モーダルは残したまま解約確認を表示。成功時のみ閉じる
                const beforeStatus = sub.status;
                await this.handleCancellation(sub);
                // handleCancellation 内で一覧更新が走る想定。状態が変わっていれば閉じる
                try {
                    // 最新のサブスク情報を取り直して対象を確認
                    await this.loadSubscriptions();
                    const latest = this.subscriptions.find(s => s.id === sub.id);
                    if (latest && latest.status === 'cancelled' && beforeStatus !== 'cancelled') {
                        if (document.body.contains(editModal)) {
                            document.body.removeChild(editModal);
                        }
                        // 解約後の詳細を表示（任意）
                        this.showSubscriptionDetail(latest);
                    }
                } catch (e) {
                    console.warn('解約後の状態確認に失敗: ', e);
                }
            });
        }

        const paymentMethodSelect = document.getElementById('paymentMethodSelect');
        if (paymentMethodSelect) {
            paymentMethodSelect.addEventListener('change', updatePaymentFields);
            setTimeout(updatePaymentFields, 100);
        }

        document.getElementById('saveSubscriptionEdit').addEventListener('click', async () => {
            const form = document.getElementById('editSubscriptionForm');
            const formData = new FormData(form);
            const updatedData = Object.fromEntries(formData.entries());

            try {
                if (updatedData.amount) {
                    updatedData.amount = parseFloat(updatedData.amount);
                    if (isNaN(updatedData.amount)) {
                        throw new Error('支払い金額は有効な数値である必要があります');
                    }
                }

                console.log('Form data before processing:', updatedData);
                const paymentDetails = {};
                
                switch (updatedData.paymentMethod) {
                    case 'CC':
                        if (updatedData.cardLastFour) {
                            paymentDetails.cardLastFour = updatedData.cardLastFour;
                            delete updatedData.cardLastFour;
                        }
                        break;
                    case 'PayPal':
                        if (updatedData.paypalEmail) {
                            paymentDetails.paypalEmail = updatedData.paypalEmail;
                            delete updatedData.paypalEmail;
                        }
                        break;
                    case 'Other':
                        if (updatedData.methodName) {
                            paymentDetails.methodName = updatedData.methodName;
                            delete updatedData.methodName;
                        }
                        if (updatedData.label) {
                            paymentDetails.label = updatedData.label;
                            delete updatedData.label;
                        }
                        break;
                }
                
                console.log('Payment details before save:', paymentDetails);
                
                updatedData.paymentDetails = JSON.stringify(paymentDetails);
                console.log('Final form data:', updatedData);
                
                const response = await fetch(`/api/subscriptions/update?id=${sub.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Username': this.getUsername()
                    },
                    body: JSON.stringify(updatedData)
                });

                if (!response.ok) throw new Error('更新に失敗しました');

                await Swal.fire('完了', 'サブスクリプション情報を更新しました', 'success');
                await this.loadSubscriptions(); // サブスクリプション一覧を更新
                document.body.removeChild(editModal);
                
                const updatedSub = this.subscriptions.find(s => s.id === sub.id);
                if (updatedSub) {
                    this.showSubscriptionDetail(updatedSub);
                }
            } catch (error) {
                Swal.fire('エラー', error.message, 'error');
            }
        });
    }

    setupNotifications() {
        setInterval(() => this.checkUpcomingPayments(), 3600000);
        this.checkUpcomingPayments();
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

document.addEventListener('DOMContentLoaded', () => {
    window.subscriptionCalendarManager = new SubscriptionCalendarManager();
});