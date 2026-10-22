var cachedUOMs = [];

$(function () {
    loadUoms();
    loadProducts();

    // Product search filter
    $("#productSearchInput").on("keyup", function () {
        var value = $(this).val().toLowerCase();
        $("#productsTableBody tr:not(.empty-row)").filter(function () {
            $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
        });
    });

    // Add New Product button click
    $("#addNewProductButton").on("click", function () {
        $("#productModalTitle").html('<i class="fa fa-plus-circle me-1 text-primary"></i> Add New Product');
        $("#productForm")[0].reset();
        $("#id").val("0");
        populateUomSelect();
        $("#productModal").modal("show");
    });

    // Edit Product button click
    $(document).on("click", ".btn-edit-product", function () {
        var id = $(this).data("id");
        var name = $(this).data("name");
        var uomId = $(this).data("uom-id");
        var price = $(this).data("price");

        $("#productModalTitle").html('<i class="fa fa-pencil me-1 text-warning"></i> Edit Product');
        $("#id").val(id);
        $("#name").val(name);
        $("#price").val(price);

        populateUomSelect(uomId);
        $("#productModal").modal("show");
    });

    // Save Product button click (handles both Insert and Edit)
    $("#saveProduct").on("click", function () {
        var id = parseInt($("#id").val()) || 0;
        var name = $.trim($("#name").val());
        var uomId = $("#uoms").val();
        var price = parseFloat($("#price").val());

        if (!name) {
            showToast("Please enter a valid product name.", "warning");
            $("#name").focus();
            return;
        }

        if (!uomId) {
            showToast("Please select a unit of measurement.", "warning");
            $("#uoms").focus();
            return;
        }

        if (isNaN(price) || price <= 0) {
            showToast("Please enter a valid price greater than 0.", "warning");
            $("#price").focus();
            return;
        }

        var saveBtn = $(this);
        saveBtn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin me-1"></i> Saving...');

        var isEdit = id > 0;
        var apiUrl = isEdit ? productEditApiUrl : productSaveApiUrl;

        var payload = {
            id: id,
            product_id: id,
            name: name,
            product_name: name,
            uom_id: uomId,
            price_per_unit: price
        };

        $.ajax({
            method: "POST",
            url: apiUrl,
            data: { data: JSON.stringify(payload) },
            dataType: "json"
        }).done(function (res) {
            $("#productModal").modal("hide");
            showToast(isEdit ? "Product updated successfully!" : "Product added successfully!", "success");
            loadProducts();
        }).fail(function (xhr) {
            var msg = "Failed to save product.";
            try {
                var json = JSON.parse(xhr.responseText);
                if (json && json.message) msg = json.message;
            } catch (e) {}
            showToast(msg, "danger");
        }).always(function () {
            saveBtn.prop("disabled", false).html('Save');
        });
    });

    // Delete Product button click
    $(document).on("click", ".btn-delete-product", function () {
        var productId = $(this).data("id");
        var productName = $(this).data("name");

        if (!confirm("Are you sure you want to delete '" + productName + "'?")) {
            return;
        }

        $.ajax({
            method: "POST",
            url: productDeleteApiUrl,
            data: { product_id: productId },
            dataType: "json"
        }).done(function (res) {
            showToast("Product '" + productName + "' deleted successfully.", "success");
            loadProducts();
        }).fail(function (xhr) {
            var msg = "Could not delete product.";
            try {
                var json = JSON.parse(xhr.responseText);
                if (json && json.message) msg = json.message;
            } catch (e) {}
            showToast(msg, "danger");
        });
    });
});

function loadUoms() {
    $.get(uomListApiUrl, function (response) {
        if (response) {
            cachedUOMs = response;
            populateUomSelect();
        }
    });
}

function populateUomSelect(selectedUomId) {
    var options = '<option value="">-- Select Unit --</option>';
    $.each(cachedUOMs, function (index, uom) {
        var selected = (selectedUomId && uom.uom_id == selectedUomId) ? ' selected' : '';
        options += '<option value="' + uom.uom_id + '"' + selected + '>' + uom.uom_name + '</option>';
    });
    $("#uoms").html(options);
}

function loadProducts() {
    var tbody = $("#productsTableBody");
    tbody.html('<tr><td colspan="5" class="text-center py-4"><i class="fa fa-spinner fa-spin"></i> Loading products...</td></tr>');

    $.get(productListApiUrl, function (products) {
        if (!products || products.length === 0) {
            tbody.html(
                '<tr class="empty-row">' +
                    '<td colspan="5" class="text-center py-5 text-muted">' +
                        '<i class="fa-solid fa-boxes-stacked fa-3x mb-3 text-secondary opacity-50"></i>' +
                        '<div class="fs-5 fw-semibold">No Products Found</div>' +
                        '<p class="small text-muted">Add your first grocery product to start building inventory.</p>' +
                    '</td>' +
                '</tr>'
            );
            return;
        }

        var rows = '';
        $.each(products, function (index, product) {
            var price = parseFloat(product.price_per_unit) || 0;
            rows += '<tr>' +
                '<td><span class="order-badge">#' + product.product_id + '</span></td>' +
                '<td><span class="fw-bold text-dark fs-6">' + escapeHtml(product.name) + '</span></td>' +
                '<td><span class="badge badge-uom">' + escapeHtml(product.uom_name) + '</span></td>' +
                '<td><span class="fw-semibold text-success fs-6">' + formatCurrency(price) + '</span></td>' +
                '<td class="text-center">' +
                    '<button type="button" class="btn btn-sm btn-outline-primary btn-edit-product me-2" ' +
                        'data-id="' + product.product_id + '" ' +
                        'data-name="' + escapeHtml(product.name) + '" ' +
                        'data-uom-id="' + product.uom_id + '" ' +
                        'data-price="' + price + '" title="Edit">' +
                        '<i class="fa-solid fa-pen-to-square me-1"></i> Edit' +
                    '</button>' +
                    '<button type="button" class="btn btn-sm btn-outline-danger btn-delete-product" ' +
                        'data-id="' + product.product_id + '" ' +
                        'data-name="' + escapeHtml(product.name) + '" title="Delete">' +
                        '<i class="fa-solid fa-trash me-1"></i> Delete' +
                    '</button>' +
                '</td>' +
            '</tr>';
        });

        tbody.html(rows);
    }).fail(function () {
        tbody.html('<tr><td colspan="5" class="text-center text-danger py-4"><i class="fa fa-triangle-exclamation me-2"></i>Failed to load products from server.</td></tr>');
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, "&amp;")
                          .replace(/</g, "&lt;")
                          .replace(/>/g, "&gt;")
                          .replace(/"/g, "&quot;")
                          .replace(/'/g, "&#039;");
}