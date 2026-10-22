// API Endpoints using relative paths for universal compatibility
var productListApiUrl = '/getProducts';
var uomListApiUrl = '/getUOM';
var productSaveApiUrl = '/insertProduct';
var productEditApiUrl = '/editProduct';
var productDeleteApiUrl = '/deleteProduct';
var orderListApiUrl = '/getAllOrders';
var orderSaveApiUrl = '/insertOrder';
var orderDeleteApiUrl = '/deleteOrder';
var orderDetailsApiUrl = '/getOrderDetails';
var dashboardStatsApiUrl = '/getDashboardStats';
var aiRecommendationsApiUrl = '/ai/recommendations';
var aiParseOrderApiUrl = '/ai/parseOrder';
var aiInsightsApiUrl = '/ai/insights';

// Format currency
function formatCurrency(amount) {
    var val = parseFloat(amount);
    if (isNaN(val)) val = 0;
    return '₹ ' + val.toFixed(2);
}

// Modern Toast Notification
function showToast(message, type) {
    type = type || 'info'; // 'success', 'danger', 'warning', 'info'
    var toastContainer = $('#toast-container');
    if (!toastContainer.length) {
        $('body').append('<div id="toast-container" class="toast-container"></div>');
        toastContainer = $('#toast-container');
    }

    var icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'danger') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    var toast = $(
        '<div class="toast-card toast-' + type + '">' +
            '<i class="fa-solid ' + icon + ' toast-icon"></i>' +
            '<div class="toast-message">' + message + '</div>' +
            '<button type="button" class="toast-close">&times;</button>' +
        '</div>'
    );

    toastContainer.append(toast);
    setTimeout(function () {
        toast.addClass('show');
    }, 10);

    var removeTimeout = setTimeout(function () {
        dismissToast(toast);
    }, 4000);

    toast.find('.toast-close').on('click', function () {
        clearTimeout(removeTimeout);
        dismissToast(toast);
    });
}

function dismissToast(toast) {
    toast.removeClass('show');
    setTimeout(function () {
        toast.remove();
    }, 300);
}

// Unified API call helper
function callApi(method, url, data, onSuccess, onError) {
    return $.ajax({
        method: method,
        url: url,
        data: data,
        dataType: 'json'
    }).done(function (response) {
        if (onSuccess) {
            onSuccess(response);
        } else {
            showToast(response.message || 'Operation successful', 'success');
            setTimeout(function () {
                window.location.reload();
            }, 800);
        }
    }).fail(function (xhr) {
        var errMessage = 'An unexpected error occurred.';
        try {
            var res = JSON.parse(xhr.responseText);
            if (res && res.message) {
                errMessage = res.message;
            }
        } catch (e) {
            if (xhr.statusText) {
                errMessage = xhr.statusText;
            }
        }
        if (onError) {
            onError(errMessage);
        } else {
            showToast(errMessage, 'danger');
        }
    });
}

// Calculate grand total and line item totals in Order form
function calculateValue() {
    var grandTotal = 0;
    $("#itemsInOrder .product-item").each(function () {
        var qty = parseFloat($(this).find('.product-qty').val());
        var price = parseFloat($(this).find('.product-price').val());

        qty = isNaN(qty) ? 0 : qty;
        price = isNaN(price) ? 0 : price;

        var lineTotal = price * qty;
        $(this).find('.product-total').val(lineTotal.toFixed(2));
        grandTotal += lineTotal;
    });

    $("#product_grand_total").val(grandTotal.toFixed(2));
    $("#display_grand_total").text(formatCurrency(grandTotal));
}