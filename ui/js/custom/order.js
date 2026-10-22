var allProducts = [];
var productMap = {};

$(function () {
    // Load products and initialize the order form
    loadProductsForOrder();

    // Change product selection
    $(document).on("change", ".cart-product", function () {
        var row = $(this).closest(".product-item");
        var productId = $(this).val();

        if (productId && productMap[productId]) {
            var product = productMap[productId];
            row.find(".product-price").val(product.price.toFixed(2));
            row.find(".product-uom-label").text("/ " + product.uom);
        } else {
            row.find(".product-price").val("0.00");
            row.find(".product-uom-label").text("");
        }

        calculateValue();
        updateAiRecommendations();
    });

    // Quantity change
    $(document).on("input change", ".product-qty", function () {
        var val = parseFloat($(this).val());
        if (isNaN(val) || val <= 0) {
            $(this).val(1);
        }
        calculateValue();
    });

    // Add another row
    $("#addMoreButton").on("click", function () {
        addNewRow();
    });

    // Remove row
    $(document).on("click", ".remove-row", function () {
        var rowCount = $("#itemsInOrder .product-item").length;
        if (rowCount > 1) {
            $(this).closest(".product-item").fadeOut(200, function () {
                $(this).remove();
                calculateValue();
                updateAiRecommendations();
            });
        } else {
            // Reset the single row rather than deleting
            var firstRow = $(this).closest(".product-item");
            firstRow.find(".cart-product").val("");
            firstRow.find(".product-price").val("0.00");
            firstRow.find(".product-qty").val(1);
            firstRow.find(".product-total").val("0.00");
            firstRow.find(".product-uom-label").text("");
            calculateValue();
            updateAiRecommendations();
            showToast("Order reset. At least one line item is required.", "info");
        }
    });

    // AI Sample Prompt Click
    $(document).on("click", ".ai-sample-chip", function () {
        var sampleText = $(this).data("sample");
        $("#aiOrderInput").val(sampleText);
        $("#btnAiParse").trigger("click");
    });

    // AI Natural Language Parse Order
    $("#btnAiParse").on("click", function () {
        var promptText = $.trim($("#aiOrderInput").val());
        if (!promptText) {
            showToast("Please enter an order description to parse.", "warning");
            $("#aiOrderInput").focus();
            return;
        }

        var btn = $(this);
        btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin me-1"></i> Parsing...');

        $.ajax({
            method: "POST",
            url: aiParseOrderApiUrl,
            data: { text: promptText },
            dataType: "json"
        }).done(function (res) {
            if (res.status === "success") {
                if (res.customer_name) {
                    $("#customerName").val(res.customer_name);
                }

                if (res.items && res.items.length > 0) {
                    $("#itemsInOrder").empty();
                    $.each(res.items, function (index, item) {
                        addNewRow(item.product_id, item.quantity);
                    });
                    calculateValue();
                    updateAiRecommendations();
                    showToast("AI parsed " + res.items.length + " items" + (res.customer_name ? " for " + res.customer_name : "") + "!", "success");
                } else {
                    showToast("AI could not detect catalog products in the text. Try specifying product name & quantity.", "warning");
                }
            }
        }).fail(function () {
            showToast("Failed to process natural language request.", "danger");
        }).always(function () {
            btn.prop("disabled", false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> AI Auto-Fill');
        });
    });

    // Click on AI Recommended Chip (+ Add)
    $(document).on("click", ".btn-ai-add-chip", function () {
        var productId = $(this).data("id");
        if (productId) {
            addNewRow(productId, 1);
            updateAiRecommendations();
            showToast("Added " + (productMap[productId] ? productMap[productId].name : "product") + " to cart!", "success");
        }
    });

    // Save Order
    $("#saveOrder").on("click", function () {
        var customerName = $.trim($("#customerName").val());
        if (!customerName) {
            showToast("Please enter customer name.", "warning");
            $("#customerName").focus();
            return;
        }

        var grandTotal = parseFloat($("#product_grand_total").val()) || 0;
        var orderDetails = [];

        $("#itemsInOrder .product-item").each(function () {
            var productId = $(this).find(".cart-product").val();
            var qty = parseFloat($(this).find(".product-qty").val());
            var lineTotal = parseFloat($(this).find(".product-total").val());

            if (productId && qty > 0) {
                orderDetails.push({
                    product_id: parseInt(productId),
                    quantity: qty,
                    total_price: lineTotal
                });
            }
        });

        if (orderDetails.length === 0) {
            showToast("Please select at least one product with valid quantity.", "warning");
            return;
        }

        if (grandTotal <= 0) {
            showToast("Grand total must be greater than zero.", "warning");
            return;
        }

        var saveBtn = $("#saveOrder");
        saveBtn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin me-1"></i> Processing Order...');

        var requestPayload = {
            customer_name: customerName,
            grand_total: grandTotal,
            order_details: orderDetails
        };

        $.ajax({
            method: "POST",
            url: orderSaveApiUrl,
            data: { data: JSON.stringify(requestPayload) },
            dataType: "json"
        }).done(function (res) {
            showToast("Order #" + res.order_id + " created successfully!", "success");
            setTimeout(function () {
                window.location.href = "index.html";
            }, 1200);
        }).fail(function (xhr) {
            var msg = "Failed to place order.";
            try {
                var json = JSON.parse(xhr.responseText);
                if (json && json.message) msg = json.message;
            } catch (e) {}
            showToast(msg, "danger");
            saveBtn.prop("disabled", false).html('<i class="fa fa-check me-1"></i> Complete Order');
        });
    });
});

function loadProductsForOrder() {
    $.get(productListApiUrl, function (response) {
        allProducts = response || [];
        productMap = {};

        $.each(allProducts, function (i, p) {
            productMap[p.product_id] = {
                name: p.name,
                price: parseFloat(p.price_per_unit) || 0,
                uom: p.uom_name
            };
        });

        // Clear and add first item row
        $("#itemsInOrder").empty();
        addNewRow();
        updateAiRecommendations();
    }).fail(function () {
        showToast("Failed to fetch product catalog.", "danger");
    });
}

function buildProductOptions(selectedId) {
    var options = '<option value="">-- Choose Product --</option>';
    $.each(allProducts, function (index, product) {
        var isSelected = (selectedId && product.product_id == selectedId) ? ' selected' : '';
        options += '<option value="' + product.product_id + '"' + isSelected + '>' +
            product.name + ' (' + formatCurrency(product.price_per_unit) + '/' + product.uom_name + ')' +
        '</option>';
    });
    return options;
}

function addNewRow(selectedId, quantity) {
    quantity = quantity || 1;
    var options = buildProductOptions(selectedId);

    var initialPrice = "0.00";
    var initialUom = "";
    if (selectedId && productMap[selectedId]) {
        initialPrice = productMap[selectedId].price.toFixed(2);
        initialUom = "/ " + productMap[selectedId].uom;
    }

    var rowHtml = $(
        '<div class="product-item card p-3 mb-3 border shadow-sm">' +
            '<div class="row align-items-center g-2">' +
                '<div class="col-md-4 col-sm-12">' +
                    '<label class="form-label small text-muted mb-1 d-md-none">Product</label>' +
                    '<select class="form-select cart-product">' +
                        options +
                    '</select>' +
                '</div>' +
                '<div class="col-md-2 col-sm-4">' +
                    '<label class="form-label small text-muted mb-1 d-md-none">Price</label>' +
                    '<div class="input-group input-group-sm">' +
                        '<span class="input-group-text">₹</span>' +
                        '<input type="text" class="form-control product-price bg-light text-end" value="' + initialPrice + '" readonly>' +
                    '</div>' +
                    '<span class="small text-muted product-uom-label">' + initialUom + '</span>' +
                '</div>' +
                '<div class="col-md-2 col-sm-4">' +
                    '<label class="form-label small text-muted mb-1 d-md-none">Quantity</label>' +
                    '<input type="number" min="1" step="any" class="form-control form-control-sm product-qty text-center" value="' + quantity + '">' +
                '</div>' +
                '<div class="col-md-3 col-sm-4">' +
                    '<label class="form-label small text-muted mb-1 d-md-none">Total</label>' +
                    '<div class="input-group input-group-sm">' +
                        '<span class="input-group-text">₹</span>' +
                        '<input type="text" class="form-control product-total bg-light fw-bold text-end text-success" value="0.00" readonly>' +
                    '</div>' +
                '</div>' +
                '<div class="col-md-1 col-sm-12 text-end">' +
                    '<button type="button" class="btn btn-outline-danger btn-sm remove-row" title="Remove line item">' +
                        '<i class="fa-solid fa-trash"></i>' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>'
    );

    $("#itemsInOrder").append(rowHtml);
    calculateValue();
}

function updateAiRecommendations() {
    var selectedProductIds = [];
    $("#itemsInOrder .product-item").each(function () {
        var id = $(this).find(".cart-product").val();
        if (id) selectedProductIds.push(parseInt(id));
    });

    $.ajax({
        method: "POST",
        url: aiRecommendationsApiUrl,
        data: { product_ids: JSON.stringify(selectedProductIds) },
        dataType: "json"
    }).done(function (res) {
        if (res.status === "success" && res.recommendations && res.recommendations.length > 0) {
            var chipsHtml = '';
            $.each(res.recommendations, function (index, rec) {
                chipsHtml += '<div class="ai-rec-chip">' +
                    '<div class="ai-rec-info">' +
                        '<div class="ai-rec-name">' + rec.name + '</div>' +
                        '<div class="ai-rec-price">' + formatCurrency(rec.price) + ' / ' + rec.uom + ' &bull; <span class="badge bg-light text-secondary">' + rec.reason + '</span></div>' +
                    '</div>' +
                    '<button type="button" class="btn-ai-add-chip" data-id="' + rec.product_id + '">' +
                        '<i class="fa-solid fa-plus me-1"></i> Add' +
                    '</button>' +
                '</div>';
            });
            $("#aiRecChips").html(chipsHtml);
            $("#aiRecommendationsBox").fadeIn(200);
        } else {
            $("#aiRecommendationsBox").fadeOut(200);
        }
    }).fail(function () {
        $("#aiRecommendationsBox").hide();
    });
}