using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AssignmentSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCommentReplyTo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReplyToCommentId",
                table: "comments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_comments_ReplyToCommentId",
                table: "comments",
                column: "ReplyToCommentId");

            migrationBuilder.AddForeignKey(
                name: "FK_comments_comments_ReplyToCommentId",
                table: "comments",
                column: "ReplyToCommentId",
                principalTable: "comments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_comments_comments_ReplyToCommentId",
                table: "comments");

            migrationBuilder.DropIndex(
                name: "IX_comments_ReplyToCommentId",
                table: "comments");

            migrationBuilder.DropColumn(
                name: "ReplyToCommentId",
                table: "comments");
        }
    }
}
