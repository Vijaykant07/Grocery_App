$(function () {
    loadDashboardStats();
    loadAiInsights();
    loadOrders();

    // Order search filtering
    $("#orderSearchInput").on("keyup", function () {
        var value = $(this).val().toLowerCase();
        $("#ordersTableBody tr:not(.empty-row):not(.total-row)").filter(function () {
            $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
        });
    });

    // View Order Details Modal Handler
    $(document).on("click", ".view-order-details", function () {
        var orderId = $(this).data("order-id");
        var customerName = $(this).data("customer-name");
        var orderTotal = $(this).data("total");
        var orderDate = $(this).data("date");

        $("#modalOrderNumber").text("#" + orderId);
        $("#modalCustomerName").text(customerName);
        $("#modalOrderDate").text(orderDate);
        $("#modalOrderTotal").text(formatCurrency(orderTotal));

        var detailsTableBody = $("#orderDetailsTableBody");
        detailsTableBody.html('<tr><td colspan="4" class="text-center py-4"><i class="fa fa-spinner fa-spin"></i> Loading items...</td></tr>');

        $("#orderDetailsModal").modal("show");

        $.get(orderDetailsApiUrl + "/" + orderId, function (items) {
            if (items && items.length > 0) {
                var html = '';
                $.each(items, function (index, item) {
                    html += '<tr>' +
                        '<td><div class="fw-bold text-dark">' + item.product_name + '</div></td>' +
                        '<td>' + formatCurrency(item.price_per_unit) + ' / ' + item.uom_name + '</td>' +
                        '<td><span class="badge badge-qty">' + item.quantity + ' ' + item.uom_name + '</span></td>' +
                        '<td class="text-end fw-bold text-success">' + formatCurrency(item.total_price) + '</td>' +
                    '</tr>';
                });
                detailsTableBody.html(html);
            } else {
                detailsTableBody.html('<tr><td colspan="4" class="text-center text-muted py-3">No line items found for this order.</td></tr>');
            }
        }).fail(function () {
            detailsTableBody.html('<tr><td colspan="4" class="text-center text-danger py-3">Failed to load order items.</td></tr>');
        });
    });

    // Delete Order Handler
    $(document).on("click", ".btn-delete-order", function () {
        var orderId = $(this).data("order-id");
        if (!confirm("Are you sure you want to delete Order #" + orderId + "? This will remove the order and its receipt records.")) {
            return;
        }

        $.ajax({
            method: "POST",
            url: orderDeleteApiUrl,
            data: { order_id: orderId },
            dataType: "json"
        }).done(function (res) {
            showToast("Order #" + orderId + " deleted successfully.", "success");
            loadDashboardStats();
            loadOrders();
        }).fail(function (xhr) {
            var msg = "Could not delete order.";
            try {
                var json = JSON.parse(xhr.responseText);
                if (json && json.message) msg = json.message;
            } catch (e) {}
            showToast(msg, "danger");
        });
    });
});

function loadDashboardStats() {
    $.get(dashboardStatsApiUrl, function (stats) {
        if (stats) {
            $("#stat_total_revenue").text(formatCurrency(stats.total_revenue));
            $("#stat_total_orders").text(stats.total_orders);
            $("#stat_total_products").text(stats.total_products);
            $("#stat_avg_order").text(formatCurrency(stats.avg_order_value));
        }
    }).fail(function () {
        console.warn("Unable to fetch dashboard statistics.");
    });
}

function loadAiInsights() {
    $.get(aiInsightsApiUrl, function (res) {
        if (res.status === "success" && res.data && res.data.insights && res.data.insights.length > 0) {
            var html = '';
            $.each(res.data.insights, function (i, insight) {
                html += '<div class="col-md-4 col-sm-12">' +
                    '<div class="ai-insight-item h-100">' +
                        '<div class="ai-insight-icon text-' + insight.color + '">' +
                            '<i class="fa-solid ' + insight.icon + '"></i>' +
                        '</div>' +
                        '<div>' +
                            '<div class="fw-bold text-dark small mb-1">' + insight.title + '</div>' +
                            '<div class="text-muted small" style="line-height: 1.3;">' + insight.detail + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            });
            $("#aiInsightsContainer").html(html);
            $("#aiInsightsPanel").show();
        } else {
            $("#aiInsightsPanel").hide();
        }
    }).fail(function () {
        $("#aiInsightsPanel").hide();
    });
}

function loadOrders() {
    var tbody = $("#ordersTableBody");
    tbody.html('<tr><td colspan="5" class="text-center py-4"><i class="fa fa-spinner fa-spin"></i> Loading orders...</td></tr>');

    $.get(orderListApiUrl, function (orders) {
        if (!orders || orders.length === 0) {
            tbody.html(
                '<tr class="empty-row">' +
                    '<td colspan="5" class="text-center py-5 text-muted">' +
                        '<i class="fa-solid fa-receipt fa-3x mb-3 text-secondary opacity-50"></i>' +
                        '<div class="fs-5 fw-semibold">No Orders Placed Yet</div>' +
                        '<p class="small text-muted">Create your first grocery order to start tracking sales.</p>' +
                        '<a href="order.html" class="btn btn-primary btn-sm mt-2"><i class="fa fa-plus me-1"></i> Create First Order</a>' +
                    '</td>' +
                '</tr>'
            );
            return;
        }

        var rows = '';
        var totalCost = 0;

        $.each(orders, function (index, order) {
            var orderTotal = parseFloat(order.total) || 0;
            totalCost += orderTotal;

            rows += '<tr>' +
                '<td><span class="order-badge">#' + order.order_id + '</span></td>' +
                '<td><span class="text-muted"><i class="fa-regular fa-clock me-1"></i>' + order.datetime + '</span></td>' +
                '<td>' +
                    '<div class="d-flex align-items-center">' +
                        '<div class="avatar-initial">' + (order.customer_name ? order.customer_name.charAt(0).toUpperCase() : 'C') + '</div>' +
                        '<span class="fw-semibold ms-2 text-dark">' + order.customer_name + '</span>' +
                    '</div>' +
                '</td>' +
                '<td><span class="fw-bold text-success fs-6">' + formatCurrency(orderTotal) + '</span></td>' +
                '<td class="text-center">' +
                    '<button type="button" class="btn btn-sm btn-outline-info view-order-details me-2" ' +
                        'data-order-id="' + order.order_id + '" ' +
                        'data-customer-name="' + escapeHtml(order.customer_name) + '" ' +
                        'data-total="' + orderTotal + '" ' +
                        'data-date="' + escapeHtml(order.datetime) + '" title="View Items">' +
                        '<i class="fa-solid fa-eye me-1"></i> View Items' +
                    '</button>' +
                    '<button type="button" class="btn btn-sm btn-outline-danger btn-delete-order" ' +
                        'data-order-id="' + order.order_id + '" title="Delete Order">' +
                        '<i class="fa-solid fa-trash me-1"></i> Delete' +
                    '</button>' +
                '</td>' +
            '</tr>';
        });

        rows += '<tr class="total-row table-light">' +
            '<td colspan="3" class="text-end fw-bold fs-6">Grand Total Sales:</td>' +
            '<td colspan="2"><span class="fw-bolder fs-5 text-primary">' + formatCurrency(totalCost) + '</span></td>' +
        '</tr>';

        tbody.html(rows);
    }).fail(function () {
        tbody.html('<tr><td colspan="5" class="text-center text-danger py-4"><i class="fa fa-triangle-exclamation me-2"></i>Failed to load orders from server.</td></tr>');
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}