// Subscription Management Module
class SubscriptionManager {
    constructor() {
        this.modal = null;
        this.form = null;
        this.initialize();
    }

    initialize() {
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        const modalHTML = `
            <div id="subscriptionModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center transition-opacity duration-300">
                <div class="bg-white bg-opacity-95 rounded-lg p-6 w-full max-w-md transform scale-95 opacity-0 transition-all duration-300">
                    <h2 class="text-2xl font-bold mb-4">サブスクリプションスケジュールを追加</h2>
                    <form id="subscriptionForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">サービス名</label>
                            <input type="text" name="serviceName" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">プラン名</label>
                            <input type="text" name="planName" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">金額</label>
                                <input type="number" name="amount" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">通貨</label>
                                <select name="currency" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                    <option value="JPY" selected>JPY</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">課金サイクル</label>
                            <select name="billingCycle" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                <option value="monthly">月額</option>
                                <option value="yearly">年額</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">決済方法</label>
                            <select name="paymentMethod" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                <option value="CC">クレジットカード</option>
                                <option value="PayPal">PayPal</option>
                                <option value="GooglePay">Google Pay</option>
                                <option value="ApplePay">Apple Pay</option>
                                <option value="PayPay">PayPay</option>
                                <option value="AmazonPay">Amazon Pay</option>
                                <option value="Other">その他</option>
                            </select>
                        </div>
                        <div id="paymentDetails" class="hidden space-y-4">
                            <div id="ccDetails" class="hidden">
                                <label class="block text-sm font-medium text-gray-700">カード末尾4桁（任意）</label>
                                <input type="text" name="cardLastFour" pattern="[0-9]{4}" maxlength="4" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                            </div>
                            <div id="paypalDetails" class="hidden">
                                <label class="block text-sm font-medium text-gray-700">PayPalメールアドレス（任意）</label>
                                <input type="email" name="paypalEmail" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                            </div>
                            <div id="otherDetails" class="hidden">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">決済方法名</label>
                                    <input type="text" name="otherPaymentMethod" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">ラベル（任意）</label>
                                    <input type="text" name="otherPaymentLabel" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                                </div>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">次回支払日</label>
                            <input type="date" name="nextPaymentDate" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                        </div>
                        <div class="flex justify-end space-x-3 pt-4">
                            <button type="button" id="cancelSubscription" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors">
                                キャンセル
                            </button>
                            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                                保存
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('subscriptionModal');
        this.form = document.getElementById('subscriptionForm');
    }

    setupEventListeners() {
        // メニューから開くためのイベントリスナー
        document.addEventListener('DOMContentLoaded', () => {
            const addButton = document.querySelector('[data-action="add-subscription"]');
            if (addButton) {
                addButton.addEventListener('click', () => this.showModal());
            }
        });

        // 決済方法の変更時の処理
        const paymentMethodSelect = this.form.querySelector('[name="paymentMethod"]');
        paymentMethodSelect.addEventListener('change', (e) => this.handlePaymentMethodChange(e));

        // フォームの送信処理
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // キャンセルボタンの処理
        document.getElementById('cancelSubscription').addEventListener('click', () => this.hideModal());

        // モーダルの外側をクリックした時の処理
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });
    }

    showModal() {
        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
        requestAnimationFrame(() => {
            this.modal.querySelector('.bg-white').classList.remove('scale-95', 'opacity-0');
            this.modal.querySelector('.bg-white').classList.add('scale-100', 'opacity-100');
        });
    }

    hideModal() {
        const modalContent = this.modal.querySelector('.bg-white');
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            this.modal.classList.remove('flex');
            this.modal.classList.add('hidden');
            this.form.reset();
            this.hideAllPaymentDetails();
        }, 300);
    }

    handlePaymentMethodChange(e) {
        this.hideAllPaymentDetails();
        const paymentDetails = document.getElementById('paymentDetails');
        const method = e.target.value;

        if (method === 'CC') {
            paymentDetails.classList.remove('hidden');
            document.getElementById('ccDetails').classList.remove('hidden');
            Swal.fire({
                title: '注意',
                text: 'セキュリティ上の理由により、カード情報の全てを入力することはできません。末尾4桁のみ任意で記録できます。',
                icon: 'warning',
                confirmButtonText: '了解'
            });
        } else if (method === 'PayPal') {
            paymentDetails.classList.remove('hidden');
            document.getElementById('paypalDetails').classList.remove('hidden');
        } else if (method === 'Other') {
            paymentDetails.classList.remove('hidden');
            document.getElementById('otherDetails').classList.remove('hidden');
        }
    }

    hideAllPaymentDetails() {
        const details = ['ccDetails', 'paypalDetails', 'otherDetails'];
        document.getElementById('paymentDetails').classList.add('hidden');
        details.forEach(id => document.getElementById(id).classList.add('hidden'));
    }

    async handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(this.form);
        const data = {
            serviceName: formData.get('serviceName'),
            planName: formData.get('planName'),
            amount: Number(formData.get('amount')),
            currency: formData.get('currency'),
            billingCycle: formData.get('billingCycle'),
            paymentMethod: formData.get('paymentMethod'),
            nextPaymentDate: formData.get('nextPaymentDate'),
            paymentDetails: {}
        };

        // 決済方法に応じた追加情報の設定
        switch (data.paymentMethod) {
            case 'CC':
                if (formData.get('cardLastFour')) {
                    data.paymentDetails.cardLastFour = formData.get('cardLastFour');
                }
                break;
            case 'PayPal':
                if (formData.get('paypalEmail')) {
                    data.paymentDetails.paypalEmail = formData.get('paypalEmail');
                }
                break;
            case 'Other':
                data.paymentDetails.methodName = formData.get('otherPaymentMethod');
                if (formData.get('otherPaymentLabel')) {
                    data.paymentDetails.label = formData.get('otherPaymentLabel');
                }
                break;
        }

        try {
            const response = await fetch('/api/subscriptions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('サーバーエラーが発生しました');
            }

            await Swal.fire({
                title: '成功',
                text: 'サブスクリプションが正常に登録されました',
                icon: 'success',
                confirmButtonText: 'OK'
            });

            this.hideModal();
            // カレンダーの更新
            if (window.calendarManager) {
                window.calendarManager.refreshCalendar();
            }
            // アカウント管理画面の更新（実装予定）
            if (window.accountManager) {
                window.accountManager.refreshSubscriptions();
            }
        } catch (error) {
            Swal.fire({
                title: 'エラー',
                text: error.message,
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    }

    // 通知スケジューラー
    async scheduleNotifications() {
        try {
            const response = await fetch('/api/subscriptions/upcoming', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('通知の取得に失敗しました');
            
            const subscriptions = await response.json();
            
            subscriptions.forEach(sub => {
                const paymentDate = new Date(sub.nextPaymentDate);
                const threeDaysBefore = new Date(paymentDate);
                threeDaysBefore.setDate(paymentDate.getDate() - 3);
                const oneDayBefore = new Date(paymentDate);
                oneDayBefore.setDate(paymentDate.getDate() - 1);

                // 3日前の通知
                if (new Date() < threeDaysBefore) {
                    setTimeout(() => {
                        Swal.fire({
                            title: 'サブスクリプション支払い予定',
                            html: `<p>${sub.serviceName}の支払いが3日後に予定されています。</p>
                                  <p>金額: ${sub.amount} ${sub.currency}</p>`,
                            icon: 'info',
                            confirmButtonText: '了解'
                        });
                    }, threeDaysBefore - new Date());
                }

                // 前日の通知
                if (new Date() < oneDayBefore) {
                    setTimeout(() => {
                        Swal.fire({
                            title: 'サブスクリプション支払い予定',
                            html: `<p>${sub.serviceName}の支払いが明日予定されています。</p>
                                  <p>金額: ${sub.amount} ${sub.currency}</p>`,
                            icon: 'warning',
                            confirmButtonText: '了解'
                        });
                    }, oneDayBefore - new Date());
                }
            });
        } catch (error) {
            console.error('通知スケジュールの設定に失敗しました:', error);
        }
    }
}

// インスタンスの作成とエクスポート
const subscriptionManager = new SubscriptionManager();
export { subscriptionManager };

// 定期的な通知チェック（1時間ごと）
setInterval(() => {
    subscriptionManager.scheduleNotifications();
}, 3600000);
